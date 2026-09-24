"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { createProductAction, setPriceAction } from "@/lib/actions/menu";
import { channelLabel, SELLABLE_CHANNELS } from "@/lib/format";
import { Field, Notice, inputStyle } from "@/components/ui";

interface ItemOpt {
  id: string;
  name: string;
  baseUnit: string;
  units: { code: string; label: string; factor: number }[];
}
interface LineDraft {
  itemId: string;
  quantity: string;
  unit: string;
  channels: SalesChannel[]; // empty = all channels
}
type Msg = { ok: boolean; text: string } | null;

const noPrices = (): Record<SalesChannel, string> => ({
  dine_in: "",
  takeaway: "",
  direct_delivery: "",
  talabat: "",
  careem: "",
  toters: "",
});

/** A product, its recipe and its prices — created in one step, or not at all. */
export function AddProductForm({
  items,
  categories = [],
}: {
  items: ItemOpt[];
  categories?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [prices, setPrices] = useState(noPrices());
  const blank = (): LineDraft => ({
    itemId: items[0]?.id ?? "",
    quantity: "",
    unit: items[0]?.baseUnit ?? "",
    channels: [],
  });
  const [lines, setLines] = useState<LineDraft[]>([blank()]);

  const itemById = (id: string) => items.find((i) => i.id === id);
  const setLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  function toggleChannel(idx: number, ch: SalesChannel) {
    setLines((ls) =>
      ls.map((l, i) =>
        i === idx
          ? {
              ...l,
              channels: l.channels.includes(ch)
                ? l.channels.filter((c) => c !== ch)
                : [...l.channels, ch],
            }
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
        categoryId: categoryId || null,
        prices: Object.fromEntries(
          SELLABLE_CHANNELS.filter((c) => prices[c].trim() !== "").map((c) => [c, prices[c]]),
        ),
        recipe: lines
          .filter((l) => l.itemId && l.quantity.trim() !== "")
          .map((l) => ({
            itemId: l.itemId,
            qty: l.quantity,
            unitCode: l.unit,
            channels: l.channels,
          })),
      });
      if (r.ok) {
        setMsg({ ok: true, text: `Created “${name}”.` });
        setName("");
        setNameAr("");
        setNameCkb("");
        setPrices(noPrices());
        setLines([blank()]);
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <strong>Add a menu product</strong>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          First add stock items on Inventory, so the recipe has ingredients to use.
        </p>
      </div>
    );
  }

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <button
        className="btn-primary"
        onClick={() => setOpen((o) => !o)}
        style={{ alignSelf: "start" }}
      >
        {open ? "▾ Hide product form" : "➕ Add menu product"}
      </button>
      {open && (
        <>
          <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
            <Field label="Product name (English)">
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Iced Latte"
              />
            </Field>
            <Field label="الاسم">
              <input
                style={inputStyle}
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                dir="rtl"
              />
            </Field>
            <Field label="ناو">
              <input
                style={inputStyle}
                value={nameCkb}
                onChange={(e) => setNameCkb(e.target.value)}
                dir="rtl"
              />
            </Field>
          </div>
          {categories.length > 0 && (
            <Field label="Category on the till">
              <select
                style={inputStyle}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div>
            <div className="muted" style={{ fontSize: ".85rem", marginBottom: 4 }}>
              Price per channel (IQD) — leave empty for channels it is not sold on
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}
            >
              {SELLABLE_CHANNELS.map((c) => (
                <label key={c}>
                  <div className="muted" style={{ fontSize: ".78rem" }}>
                    {channelLabel[c]}
                  </div>
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
              Recipe — one serving. Leave channels unticked for “all channels”; tick channels for
              packaging used only there.
            </div>
            <div className="grid" style={{ gap: 8 }}>
              {lines.map((l, idx) => {
                const it = itemById(l.itemId);
                return (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 8,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                      <label style={{ flex: 2, minWidth: 160 }}>
                        <div className="muted" style={{ fontSize: ".78rem" }}>
                          Ingredient
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
                      <label style={{ flex: 1, minWidth: 90 }}>
                        <div className="muted" style={{ fontSize: ".78rem" }}>
                          Quantity
                        </div>
                        <input
                          style={inputStyle}
                          value={l.quantity}
                          onChange={(e) => setLine(idx, { quantity: e.target.value })}
                          inputMode="decimal"
                        />
                      </label>
                      <label style={{ flex: 1, minWidth: 100 }}>
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
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                        disabled={lines.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {SELLABLE_CHANNELS.map((c) => (
                        <label
                          key={c}
                          style={{
                            fontSize: ".8rem",
                            display: "flex",
                            gap: 4,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={l.channels.includes(c)}
                            onChange={() => toggleChannel(idx, c)}
                          />
                          {channelLabel[c]}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setLines((ls) => [...ls, blank()])}
                style={{ alignSelf: "start" }}
              >
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

/** A new price from a date. The old price stays in force until then; history is kept. */
export function PriceChange({ variantId, today }: { variantId: string; today: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<SalesChannel>("dine_in");
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState(today);
  const [msg, setMsg] = useState<Msg>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ marginBlockStart: 8, fontSize: ".8rem" }}>
        Change a price…
      </button>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        flexWrap: "wrap",
        marginBlockStart: 8,
      }}
    >
      <label>
        <div className="muted" style={{ fontSize: ".75rem" }}>
          Channel
        </div>
        <select value={channel} onChange={(e) => setChannel(e.target.value as SalesChannel)}>
          {SELLABLE_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {channelLabel[c]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <div className="muted" style={{ fontSize: ".75rem" }}>
          New price
        </div>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          style={{ width: 110 }}
        />
      </label>
      <label>
        <div className="muted" style={{ fontSize: ".75rem" }}>
          From
        </div>
        <input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <button
        className="btn-primary"
        disabled={busy || !price.trim()}
        onClick={() =>
          start(async () => {
            const r = await setPriceAction({ variantId, channel, price, effectiveFrom: from });
            if (r.ok) {
              setMsg({
                ok: true,
                text:
                  from === today
                    ? "Price changed from today."
                    : `New price takes effect on ${from}.`,
              });
              setPrice("");
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {busy ? "…" : "Set price"}
      </button>
      <Notice msg={msg} />
    </div>
  );
}
