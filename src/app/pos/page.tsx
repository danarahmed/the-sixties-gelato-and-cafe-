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

const CHANNELS: SalesChannel[] = ["dine_in", "takeaway", "direct_delivery", "talabat"];

export default function PosPage() {
  const { t } = useT();
  const [productId, setProductId] = useState(DEMO_PRODUCTS[0]!.id);
  const [channel, setChannel] = useState<SalesChannel>("takeaway");

  const product = DEMO_PRODUCTS.find((p) => p.id === productId)!;

  const { deductions, cost, price, margin, marginPct } = useMemo(() => {
    const recipe = DEMO_RECIPES[product.recipeId]!;
    const ds = expandRecipeForSale(recipe, channel, 1, resolverContext);
    let total = Money.zero(IQD);
    const rows = ds.map((d) => {
      const unit = averageUnitCost(wacByItem.get(d.itemId)!);
      const lineCost = unit.multiply(d.baseQuantity);
      total = total.add(lineCost);
      return { itemId: d.itemId, qty: d.baseQuantity.toString(), lineCost: lineCost.quantize() };
    });
    const priceVal = Money.of(product.price[channel] ?? 0, IQD);
    const marginVal = priceVal.subtract(total);
    const pct = priceVal.isPositive()
      ? marginVal
          .toDecimalValue()
          .dividedBy(priceVal.toDecimalValue())
          .times(100)
          .toDecimalPlaces(1)
          .toString()
      : "0";
    return {
      deductions: rows,
      cost: total.quantize(),
      price: priceVal,
      margin: marginVal.quantize(),
      marginPct: pct,
    };
  }, [product, channel]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("pos.title")}</h1>

      <div className="pos-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("pos.pickProduct")}</h3>
          <div className="product-grid">
            {DEMO_PRODUCTS.map((p) => (
              <button
                key={p.id}
                className={`product-tile ${p.id === productId ? "selected" : ""}`}
                onClick={() => setProductId(p.id)}
              >
                <span>{p.name}</span>
                <span className="price mono">{(p.price[channel] ?? 0).toLocaleString()} IQD</span>
              </button>
            ))}
          </div>

          <h3>{t("pos.channel")}</h3>
          <div className="channel-tabs">
            {CHANNELS.map((c) => (
              <button
                key={c}
                className={c === channel ? "active" : ""}
                onClick={() => setChannel(c)}
              >
                {t(`pos.channel.${c}`)}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: ".9rem" }}>
            {t("pos.explainChannel")}
          </p>
        </div>

        <div className="card">
          <div className="stat">
            <span className="label">{t("pos.price")}</span>
            <span className="value mono">{price.format()}</span>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
          <div className="deduction-row">
            <span className="muted">{t("pos.cost")}</span>
            <span className="mono">{cost.format()}</span>
          </div>
          <div className="deduction-row">
            <span className="muted">{t("pos.margin")}</span>
            <span
              className="mono"
              style={{ color: margin.isNegative() ? "var(--err)" : "var(--ok)" }}
            >
              {margin.format()} ({marginPct}%)
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("pos.deductions")}</h3>
        <table>
          <thead>
            <tr>
              <th>{t("pos.item")}</th>
              <th className="right">{t("pos.qty")}</th>
              <th className="right">{t("pos.lineCost")}</th>
            </tr>
          </thead>
          <tbody>
            {deductions.map((d) => (
              <tr key={d.itemId}>
                <td>{itemName(d.itemId)}</td>
                <td className="right mono">{d.qty}</td>
                <td className="right mono">{d.lineCost.format()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
