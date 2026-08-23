"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { recordSaleAction } from "@/lib/db/actions";
import { channelLabel, fmtIQD, SELLABLE_CHANNELS } from "@/lib/format";
import { Notice } from "@/components/ui";

export interface PosVariant {
  variantId: string;
  productName: string;
  variantName: string;
  priceByChannel: Partial<Record<SalesChannel, number>>;
  cogsByChannel: Partial<Record<SalesChannel, number>>;
}

interface CartLine {
  variantId: string;
  qty: number;
}

interface Receipt {
  id: string;
  net: number;
  cogs: number;
  tender: string;
  channel: SalesChannel;
}

export function PosClient({ variants }: { variants: PosVariant[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channel, setChannel] = useState<SalesChannel>("takeaway");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const byId = useMemo(() => new Map(variants.map((v) => [v.variantId, v])), [variants]);

  function add(variantId: string) {
    setReceipt(null);
    setMsg(null);
    setCart((c) => {
      const found = c.find((l) => l.variantId === variantId);
      if (found) return c.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { variantId, qty: 1 }];
    });
  }
  function changeQty(variantId: string, delta: number) {
    setCart((c) =>
      c.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0),
    );
  }

  const totals = useMemo(() => {
    let price = 0;
    let cogs = 0;
    for (const l of cart) {
      const v = byId.get(l.variantId);
      if (!v) continue;
      price += (v.priceByChannel[channel] ?? 0) * l.qty;
      cogs += (v.cogsByChannel[channel] ?? 0) * l.qty;
    }
    const margin = price - cogs;
    const pct = price > 0 ? ((margin / price) * 100).toFixed(1) : "0";
    return { price, cogs, margin, pct };
  }, [cart, channel, byId]);

  function checkout(tender: "cash" | "card" | "platform_paid") {
    if (cart.length === 0) return;
    setMsg(null);
    start(async () => {
      const r = await recordSaleAction({
        channel,
        tender,
        lines: cart.map((l) => ({ variantId: l.variantId, qty: l.qty })),
      });
      if (r.ok) {
        setReceipt({
          id: r.id!.slice(0, 8),
          net: r.net ?? totals.price,
          cogs: r.cogs ?? totals.cogs,
          tender,
          channel,
        });
        setCart([]);
        router.refresh();
      } else setMsg({ ok: false, text: r.error ?? "Sale failed" });
    });
  }

  const tenderFor = channel === "talabat" || channel === "direct_delivery" ? "platform_paid" : null;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="channel-tabs">
        {SELLABLE_CHANNELS.map((c) => (
          <button key={c} className={c === channel ? "active" : ""} onClick={() => setChannel(c)}>
            {channelLabel[c]}
          </button>
        ))}
      </div>

      <div className="pos-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pick a product</h3>
          <div className="product-grid">
            {variants.map((v) => {
              const price = v.priceByChannel[channel];
              const disabled = price == null;
              return (
                <button
                  key={v.variantId}
                  className="product-tile"
                  onClick={() => add(v.variantId)}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.5 } : undefined}
                  title={disabled ? `No ${channelLabel[channel]} price set` : undefined}
                >
                  <span>{v.productName}</span>
                  <span className="price mono">{price == null ? "—" : fmtIQD(price)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>🛒 {cart.length === 0 ? "Cart empty" : "Cart"}</h3>
          {cart.map((l) => {
            const v = byId.get(l.variantId)!;
            return (
              <div key={l.variantId} className="deduction-row" style={{ alignItems: "center" }}>
                <span style={{ flex: 1 }}>{v.productName}</span>
                <button onClick={() => changeQty(l.variantId, -1)} style={{ minHeight: 32, minWidth: 32, padding: 0 }}>
                  −
                </button>
                <span className="mono" style={{ width: 28, textAlign: "center" }}>
                  {l.qty}
                </span>
                <button onClick={() => changeQty(l.variantId, 1)} style={{ minHeight: 32, minWidth: 32, padding: 0 }}>
                  +
                </button>
                <span className="mono" style={{ width: 90, textAlign: "end" }}>
                  {fmtIQD((v.priceByChannel[channel] ?? 0) * l.qty)}
                </span>
              </div>
            );
          })}

          {cart.length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
              <div className="deduction-row">
                <strong>Price</strong>
                <strong className="mono">{fmtIQD(totals.price)}</strong>
              </div>
              <div className="deduction-row">
                <span className="muted">Cost (COGS)</span>
                <span className="mono">{fmtIQD(totals.cogs)}</span>
              </div>
              <div className="deduction-row">
                <span className="muted">Margin</span>
                <span className="mono" style={{ color: totals.margin < 0 ? "var(--err)" : "var(--ok)" }}>
                  {fmtIQD(totals.margin)} ({totals.pct}%)
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {tenderFor ? (
                  <button className="btn-primary" style={{ flex: 1 }} disabled={pending} onClick={() => checkout("platform_paid")}>
                    {pending ? "…" : "🧾 Complete (platform-paid)"}
                  </button>
                ) : (
                  <>
                    <button className="btn-primary" style={{ flex: 1 }} disabled={pending} onClick={() => checkout("cash")}>
                      {pending ? "…" : "💵 Cash"}
                    </button>
                    <button className="btn-primary" style={{ flex: 1 }} disabled={pending} onClick={() => checkout("card")}>
                      {pending ? "…" : "💳 Card"}
                    </button>
                  </>
                )}
                <button onClick={() => setCart([])} disabled={pending}>
                  Clear
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: 10 }}>
            <Notice msg={msg} />
          </div>

          {receipt && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "var(--surface-2)" }}>
              <div className="deduction-row">
                <strong>✅ Sale {receipt.id} recorded</strong>
                <span className="badge ok">{receipt.tender}</span>
              </div>
              <p className="muted" style={{ fontSize: ".85rem", margin: "4px 0" }}>
                {channelLabel[receipt.channel]} · net {fmtIQD(receipt.net)} · COGS {fmtIQD(receipt.cogs)} · posted to
                the ledger, orders, and journal.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
