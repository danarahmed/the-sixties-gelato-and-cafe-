"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { createProductAction } from "@/lib/db/actions";
import { channelLabel, SELLABLE_CHANNELS } from "@/lib/format";
import { Field, Notice, inputStyle } from "@/components/ui";

interface ItemOpt {
  id: string;
  name: string;
  baseUnit: string;
}
interface LineDraft {
  itemId: string;
  quantity: string;
  channels: SalesChannel[]; // empty = all channels
}

export function AddProductForm({ items }: { items: ItemOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [prices, setPrices] = useState<Record<SalesChannel, string>>({
    dine_in: "",
    takeaway: "",
    direct_delivery: "",
    talabat: "",
    careem: "",
    toters: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([{ itemId: items[0]?.id ?? "", quantity: "", channels: [] }]);

  const unitOf = (id: string) => items.find((i) => i.id === id)?.baseUnit ?? "";

  function toggleChannel(idx: number, ch: SalesChannel) {
    setLines((ls) =>
      ls.map((l, i) =>
        i === idx
          ? { ...l, channels: l.channels.includes(ch) ? l.channels.filter((c) => c !== ch) : [...l.channels, ch] }
          : l,
      ),
    );
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createProductAction({
        name,
        nameAr,
        nameCkb,
        prices: Object.fromEntries(
          SELLABLE_CHANNELS.filter((c) => Number(prices[c]) > 0).map((c) => [c, Number(prices[c])]),
        ) as Partial<Record<SalesChannel, number>>,
        recipeLines: lines
          .filter((l) => l.itemId && Number(l.quantity) > 0)
          .map((l) => ({
            itemId: l.itemId,
            quantity: Number(l.quantity),
            unitCode: unitOf(l.itemId),
            channels: l.channels,
          })),
      });
      if (r.ok) {
        setMsg({ ok: true, text: `Created “${name}”.` });
        setName("");
        setNameAr("");
        setNameCkb("");
        setPrices({ dine_in: "", takeaway: "", direct_delivery: "", talabat: "", careem: "", toters: "" });
        setLines([{ itemId: items[0]?.id ?? "", quantity: "", channels: [] }]);
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Failed" });
    });
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <strong>Add a menu product</strong>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          First add some stock items (Inventory) so a recipe has ingredients to consume.
        </p>
      </div>
    );
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <button className="btn-primary" onClick={() => setOpen((o) => !o)} style={{ alignSelf: "start" }}>
        {open ? "▾ Hide product form" : "➕ Add menu product"}
      </button>
      {open && (
        <>
          <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
            <Field label="Product name (English)">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Iced Latte" />
            </Field>
            <Field label="الاسم">
              <input style={inputStyle} value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
            </Field>
            <Field label="ناو">
              <input style={inputStyle} value={nameCkb} onChange={(e) => setNameCkb(e.target.value)} dir="rtl" />
            </Field>
          </div>

          <div>
            <div className="muted" style={{ fontSize: ".85rem", marginBottom: 4 }}>
              Price per channel (IQD)
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {SELLABLE_CHANNELS.map((c) => (
                <label key={c}>
                  <div className="muted" style={{ fontSize: ".78rem" }}>{channelLabel[c]}</div>
                  <input
                    style={inputStyle}
                    value={prices[c]}
                    onChange={(e) => setPrices({ ...prices, [c]: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="muted" style={{ fontSize: ".85rem", marginBottom: 4 }}>
              Recipe — quantities are in each item’s base unit. Leave channels unticked for “all
              channels”; tick specific channels for packaging that only applies there.
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {lines.map((l, idx) => (
                <div
                  key={idx}
                  style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8, display: "grid", gap: 6 }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                    <label style={{ flex: 2, minWidth: 160 }}>
                      <div className="muted" style={{ fontSize: ".78rem" }}>Ingredient</div>
                      <select
                        style={inputStyle}
                        value={l.itemId}
                        onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, itemId: e.target.value } : x)))}
                      >
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.baseUnit})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ flex: 1, minWidth: 90 }}>
                      <div className="muted" style={{ fontSize: ".78rem" }}>Qty ({unitOf(l.itemId)})</div>
                      <input
                        style={inputStyle}
                        value={l.quantity}
                        onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                        inputMode="decimal"
                      />
                    </label>
                    <button onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} disabled={lines.length === 1}>
                      Remove
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {SELLABLE_CHANNELS.map((c) => (
                      <label key={c} style={{ fontSize: ".8rem", display: "flex", gap: 4, alignItems: "center" }}>
                        <input type="checkbox" checked={l.channels.includes(c)} onChange={() => toggleChannel(idx, c)} />
                        {channelLabel[c]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => setLines((ls) => [...ls, { itemId: items[0]?.id ?? "", quantity: "", channels: [] }])} style={{ alignSelf: "start" }}>
                + Add ingredient
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn-primary" onClick={submit} disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Create product"}
            </button>
            <Notice msg={msg} />
          </div>
        </>
      )}
    </div>
  );
}
