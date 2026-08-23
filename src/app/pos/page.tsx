"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { IQD, Money } from "@domain/money/money.js";
import { averageUnitCost } from "@domain/costing/wac.js";
import { expandRecipeForSale, type SalesChannel } from "@domain/sales/recipe.js";
import {
  DEMO_PRODUCTS,
  DEMO_RECIPES,
  resolverContext,
  wacByItem,
  itemName,
} from "@/lib/demo/catalog";
import { channelLabel } from "@/lib/demo/data";

const CHANNELS: SalesChannel[] = ["dine_in", "takeaway", "direct_delivery", "talabat"];

interface CartLine {
  productId: string;
  qty: number;
}

interface Receipt {
  id: string;
  channel: SalesChannel;
  price: Money;
  cogs: Money;
  margin: Money;
  lines: { name: string; qty: number; total: Money }[];
  deductions: { name: string; qty: string; cost: Money }[];
  tender: string;
}

export default function PosPage() {
  const { t } = useT();
  const [channel, setChannel] = useState<SalesChannel>("takeaway");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  function addToCart(productId: string) {
    setReceipt(null);
    setCart((c) => {
      const found = c.find((l) => l.productId === productId);
      if (found) return c.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { productId, qty: 1 }];
    });
  }
  function changeQty(productId: string, delta: number) {
    setCart((c) =>
      c
        .map((l) => (l.productId === productId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }
  function clearCart() {
    setCart([]);
    setReceipt(null);
  }

  const totals = useMemo(() => {
    let price = Money.zero(IQD);
    let cogs = Money.zero(IQD);
    const deductions = new Map<string, { qty: number; cost: Money }>();
    for (const line of cart) {
      const p = DEMO_PRODUCTS.find((x) => x.id === line.productId)!;
      const recipe = DEMO_RECIPES[p.recipeId]!;
      price = price.add(Money.of(p.price[channel] ?? 0, IQD).multiply(line.qty));
      for (const d of expandRecipeForSale(recipe, channel, line.qty, resolverContext)) {
        const unit = averageUnitCost(wacByItem.get(d.itemId)!);
        cogs = cogs.add(unit.multiply(d.baseQuantity));
        const prev = deductions.get(d.itemId);
        const qty = Number(d.baseQuantity.toString());
        deductions.set(d.itemId, {
          qty: (prev?.qty ?? 0) + qty,
          cost: (prev?.cost ?? Money.zero(IQD)).add(unit.multiply(d.baseQuantity)),
        });
      }
    }
    const margin = price.subtract(cogs);
    const pct = price.isPositive()
      ? margin
          .toDecimalValue()
          .dividedBy(price.toDecimalValue())
          .times(100)
          .toDecimalPlaces(1)
          .toString()
      : "0";
    return {
      price: price.quantize(),
      cogs: cogs.quantize(),
      margin: margin.quantize(),
      pct,
      deductions,
    };
  }, [cart, channel]);

  function complete(tender: string) {
    if (cart.length === 0) return;
    const deductions = [...totals.deductions.entries()].map(([itemId, v]) => ({
      name: itemName(itemId),
      qty: String(v.qty),
      cost: v.cost.quantize(),
    }));
    const lines = cart.map((l) => {
      const p = DEMO_PRODUCTS.find((x) => x.id === l.productId)!;
      return {
        name: p.name,
        qty: l.qty,
        total: Money.of(p.price[channel] ?? 0, IQD)
          .multiply(l.qty)
          .quantize(),
      };
    });
    setReceipt({
      id:
        "S-" +
        (1046 + (Math.floor(cart.length + totals.price.toDecimalValue().toNumber()) % 900) + 1),
      channel,
      price: totals.price,
      cogs: totals.cogs,
      margin: totals.margin,
      lines,
      deductions,
      tender,
    });
    setCart([]);
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("pos.title")}</h1>

      <div className="channel-tabs">
        {CHANNELS.map((c) => (
          <button key={c} className={c === channel ? "active" : ""} onClick={() => setChannel(c)}>
            {channelLabel[c]}
          </button>
        ))}
      </div>

      <div className="pos-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("pos.pickProduct")}</h3>
          <div className="product-grid">
            {DEMO_PRODUCTS.map((p) => (
              <button key={p.id} className="product-tile" onClick={() => addToCart(p.id)}>
                <span>{p.name}</span>
                <span className="price mono">{(p.price[channel] ?? 0).toLocaleString()} IQD</span>
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: ".9rem" }}>
            {t("pos.explainChannel")}
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>🛒 {cart.length === 0 ? "Cart empty" : "Cart"}</h3>
          {cart.map((l) => {
            const p = DEMO_PRODUCTS.find((x) => x.id === l.productId)!;
            return (
              <div key={l.productId} className="deduction-row" style={{ alignItems: "center" }}>
                <span style={{ flex: 1 }}>{p.name}</span>
                <button
                  onClick={() => changeQty(l.productId, -1)}
                  style={{ minHeight: 32, minWidth: 32, padding: 0 }}
                >
                  −
                </button>
                <span className="mono" style={{ width: 28, textAlign: "center" }}>
                  {l.qty}
                </span>
                <button
                  onClick={() => changeQty(l.productId, 1)}
                  style={{ minHeight: 32, minWidth: 32, padding: 0 }}
                >
                  +
                </button>
                <span className="mono" style={{ width: 90, textAlign: "end" }}>
                  {Money.of(p.price[channel] ?? 0, IQD)
                    .multiply(l.qty)
                    .format()}
                </span>
              </div>
            );
          })}
          {cart.length > 0 && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
              <div className="deduction-row">
                <strong>{t("pos.price")}</strong>
                <strong className="mono">{totals.price.format()}</strong>
              </div>
              <div className="deduction-row">
                <span className="muted">{t("pos.cost")}</span>
                <span className="mono">{totals.cogs.format()}</span>
              </div>
              <div className="deduction-row">
                <span className="muted">{t("pos.margin")}</span>
                <span
                  className="mono"
                  style={{ color: totals.margin.isNegative() ? "var(--err)" : "var(--ok)" }}
                >
                  {totals.margin.format()} ({totals.pct}%)
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => complete("Cash")}
                >
                  💵 Cash
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => complete("Card")}
                >
                  💳 Card
                </button>
                <button onClick={clearCart}>Clear</button>
              </div>
            </>
          )}

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
                <strong>✅ Sale {receipt.id} complete</strong>
                <span className="badge ok">{receipt.tender}</span>
              </div>
              <p className="muted" style={{ fontSize: ".85rem", margin: "4px 0" }}>
                {channelLabel[receipt.channel]} · net {receipt.price.format()} · margin{" "}
                {receipt.margin.format()}
              </p>
              <details>
                <summary className="muted" style={{ cursor: "pointer", fontSize: ".85rem" }}>
                  Inventory movements this sale posts ({receipt.deductions.length})
                </summary>
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    {receipt.deductions.map((d) => (
                      <tr key={d.name}>
                        <td>{d.name}</td>
                        <td className="right mono">−{d.qty}</td>
                        <td className="right mono">{d.cost.format()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {t("pos.deductions")} — {channelLabel[channel]}
          </h3>
          <table>
            <thead>
              <tr>
                <th>{t("pos.item")}</th>
                <th className="right">{t("pos.qty")}</th>
                <th className="right">{t("pos.lineCost")}</th>
              </tr>
            </thead>
            <tbody>
              {[...totals.deductions.entries()].map(([itemId, v]) => (
                <tr key={itemId}>
                  <td>{itemName(itemId)}</td>
                  <td className="right mono">{v.qty}</td>
                  <td className="right mono">{v.cost.quantize().format()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
