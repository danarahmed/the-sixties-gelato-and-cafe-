"use client";

import { useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { recordSaleAction, type SaleReceipt } from "@/lib/actions/sales";
import { fmtIQD, PLATFORM_CHANNELS, SELLABLE_CHANNELS } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { useOnline } from "@/components/AppShell";
import { Notice } from "@/components/ui";
import type { PosItem } from "@/lib/db/reports";

type Tender = "cash" | "card" | "platform_paid";

interface CartLine {
  variantId: string;
  qty: number;
}

/** A checkout the till sent but never heard back about. */
interface Pending {
  key: string;
  channel: SalesChannel;
  tender: Tender;
  lines: CartLine[];
}

const PENDING_KEY = "sixties.pos.pending";

function loadPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}
function savePending(p: Pending | null) {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode: the pending sale stays in memory only */
  }
}

/**
 * The till. Each cart gets an idempotency key the moment it starts, and the
 * key travels with every attempt to record it — so a double tap, a retry, or
 * a response lost to a dropped connection can never record the sale twice
 * (audit H-01). If the till does not hear back, the cart is frozen until the
 * cashier retries: the retry either records the sale or returns the one
 * already recorded.
 */
export function PosClient({ items, canSeeCost }: { items: PosItem[]; canSeeCost: boolean }) {
  const { t } = useT();
  const online = useOnline();
  const [channel, setChannel] = useState<SalesChannel>("takeaway");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [key, setKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [receipt, setReceipt] = useState<(SaleReceipt & { tender: Tender }) | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // A sale left unconfirmed before a reload is brought back for its retry.
  useEffect(() => {
    const p = loadPending();
    if (p) {
      setPending(p);
      setChannel(p.channel);
      setCart(p.lines);
      setKey(p.key);
      setMsg({ ok: false, text: t("pos.uncertain") });
    }
  }, [t]);

  const byId = useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const frozen = pending !== null || sending;
  const isPlatform = PLATFORM_CHANNELS.includes(channel);
  const channels = SELLABLE_CHANNELS.filter((c) => items.some((i) => i.prices[c] !== undefined));

  const total = useMemo(
    () =>
      cart.reduce((sum, l) => {
        const price = byId.get(l.variantId)?.prices[channel];
        return price === undefined ? sum : sum.plus(new Decimal(price).times(l.qty));
      }, new Decimal(0)),
    [cart, channel, byId],
  );

  function add(variantId: string) {
    if (frozen) return;
    setReceipt(null);
    setMsg(null);
    // A new cart is a new sale: it gets its own key, minted here, once.
    if (cart.length === 0 || key === null) setKey(crypto.randomUUID());
    setCart((c) => {
      const found = c.find((l) => l.variantId === variantId);
      if (found) return c.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { variantId, qty: 1 }];
    });
  }
  function changeQty(variantId: string, delta: number) {
    if (frozen) return;
    setCart((c) =>
      c
        .map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }
  function clear() {
    if (frozen) return;
    setCart([]);
    setKey(null);
    setMsg(null);
  }

  async function send(p: Pending) {
    setSending(true);
    setMsg(null);
    try {
      const r = await recordSaleAction({
        key: p.key,
        channel: p.channel,
        tender: p.tender,
        lines: p.lines.map((l) => ({ variantId: l.variantId, qty: String(l.qty) })),
      });
      if (r.ok) {
        setReceipt({ ...r.data, tender: p.tender });
        setMsg(r.data.replayed ? { ok: true, text: t("pos.replayed") } : null);
        setCart([]);
        setKey(null);
        setPending(null);
        savePending(null);
      } else {
        // The database refused it: nothing was recorded, the cart is still here.
        setPending(null);
        savePending(null);
        setMsg({ ok: false, text: r.error });
      }
    } catch {
      // No answer: it may or may not have been recorded. Freeze and retry
      // with the SAME key, which cannot record it twice.
      setPending(p);
      savePending(p);
      setMsg({ ok: false, text: t("pos.uncertain") });
    } finally {
      setSending(false);
    }
  }

  function checkout(tender: Tender) {
    if (cart.length === 0 || frozen) return;
    if (!online) {
      setMsg({ ok: false, text: t("pos.offlineBlocked") });
      return;
    }
    const saleKey = key ?? crypto.randomUUID();
    setKey(saleKey);
    void send({ key: saleKey, channel, tender, lines: cart });
  }

  function discardPending() {
    setPending(null);
    savePending(null);
    setCart([]);
    setKey(null);
    setMsg({ ok: false, text: t("pos.discardWarning") });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="channel-tabs">
        {channels.map((c) => (
          <button
            key={c}
            className={c === channel ? "active" : ""}
            onClick={() => !frozen && setChannel(c)}
            disabled={frozen && c !== channel}
          >
            {t(`pos.channel.${c}`)}
          </button>
        ))}
      </div>

      <div className="pos-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("pos.pickProduct")}</h3>
          <div className="product-grid">
            {items.map((v) => {
              const price = v.prices[channel];
              const disabled = price === undefined || frozen;
              return (
                <button
                  key={v.variantId}
                  className="product-tile"
                  onClick={() => add(v.variantId)}
                  disabled={disabled}
                  style={price === undefined ? { opacity: 0.5 } : undefined}
                  title={price === undefined ? t("pos.noPrice") : undefined}
                >
                  <span>
                    {v.productName}
                    {v.variantName && v.variantName !== v.productName ? ` — ${v.variantName}` : ""}
                  </span>
                  <span className="price mono">{price === undefined ? "—" : fmtIQD(price)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            🛒 {cart.length === 0 ? t("pos.cartEmpty") : t("pos.cart")}
          </h3>
          {cart.map((l) => {
            const v = byId.get(l.variantId);
            const price = v?.prices[channel];
            return (
              <div key={l.variantId} className="deduction-row" style={{ alignItems: "center" }}>
                <span style={{ flex: 1 }}>{v?.productName ?? "—"}</span>
                <button
                  onClick={() => changeQty(l.variantId, -1)}
                  disabled={frozen}
                  style={{ minHeight: 32, minWidth: 32, padding: 0 }}
                  aria-label="−"
                >
                  −
                </button>
                <span className="mono" style={{ width: 28, textAlign: "center" }}>
                  {l.qty}
                </span>
                <button
                  onClick={() => changeQty(l.variantId, 1)}
                  disabled={frozen}
                  style={{ minHeight: 32, minWidth: 32, padding: 0 }}
                  aria-label="+"
                >
                  +
                </button>
                <span className="mono" style={{ width: 100, textAlign: "end" }}>
                  {price === undefined ? "—" : fmtIQD(new Decimal(price).times(l.qty).toNumber())}
                </span>
              </div>
            );
          })}

          {cart.length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
              <div className="deduction-row">
                <strong>{t("pos.total")}</strong>
                <strong className="mono">{fmtIQD(total.toNumber())}</strong>
              </div>

              {pending ? (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled={sending}
                    onClick={() => send(pending)}
                  >
                    {sending ? "…" : t("pos.retry")}
                  </button>
                  <button onClick={discardPending} disabled={sending}>
                    {t("pos.discardPending")}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {isPlatform ? (
                    <button
                      className="btn-primary"
                      style={{ flex: 1 }}
                      disabled={sending || !online}
                      onClick={() => checkout("platform_paid")}
                    >
                      {sending ? "…" : `🧾 ${t("pos.platformPaid")}`}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        disabled={sending || !online}
                        onClick={() => checkout("cash")}
                      >
                        {sending ? "…" : `💵 ${t("pos.cash")}`}
                      </button>
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        disabled={sending || !online}
                        onClick={() => checkout("card")}
                      >
                        {sending ? "…" : `💳 ${t("pos.card")}`}
                      </button>
                    </>
                  )}
                  <button onClick={clear} disabled={sending}>
                    {t("pos.clear")}
                  </button>
                </div>
              )}
              {!online && !pending && (
                <p className="red" style={{ fontSize: ".82rem", marginBlockEnd: 0 }}>
                  {t("pos.offlineBlocked")}
                </p>
              )}
            </>
          )}

          <div style={{ marginTop: 10 }}>
            <Notice msg={msg} />
          </div>

          {receipt && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                background: "var(--surface-2)",
              }}
            >
              <div className="deduction-row">
                <strong>
                  ✅ {t("pos.recorded")} · {receipt.orderId.slice(0, 8)}
                </strong>
                <span className="badge ok">{t(`pos.tender.${receipt.tender}`)}</span>
              </div>
              <p className="muted" style={{ fontSize: ".85rem", margin: "4px 0" }}>
                {fmtIQD(receipt.net)}
                {receipt.journalNo !== null ? ` · ${t("pos.journal")} ${receipt.journalNo}` : ""}
                {canSeeCost && receipt.cogs !== undefined
                  ? ` · ${t("pos.cost")} ${fmtIQD(receipt.cogs)}`
                  : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
