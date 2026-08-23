"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { runBatch, batchItemName, BATCH_RECIPE } from "@/lib/demo/production";

export default function ProductionPage() {
  const { t } = useT();
  const [batches, setBatches] = useState(1);
  const [actualYield, setActualYield] = useState(4800);

  const result = useMemo(() => runBatch(batches, actualYield), [batches, actualYield]);
  const planned = Number(BATCH_RECIPE.batchYieldBase) * batches;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.production")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Pistachio gelato batch. Finished stock is valued at the <strong>actual</strong> cost
        consumed ÷ the <strong>actual</strong> yield — computed by the tested engine.
      </p>

      <div className="card">
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            <div className="muted" style={{ fontSize: ".85rem" }}>
              Batches
            </div>
            <input
              type="number"
              min={1}
              value={batches}
              onChange={(e) => setBatches(Math.max(1, Number(e.target.value) || 1))}
              style={inputStyle}
            />
          </label>
          <label>
            <div className="muted" style={{ fontSize: ".85rem" }}>
              Actual yield (g) — planned {planned.toLocaleString()} g
            </div>
            <input
              type="number"
              min={0}
              value={actualYield}
              onChange={(e) => setActualYield(Math.max(0, Number(e.target.value) || 0))}
              style={inputStyle}
            />
          </label>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}>
        <div className="card stat">
          <span className="label">Total consumed cost</span>
          <span className="value mono">{result.totalConsumedValue.format()}</span>
        </div>
        <div className="card stat">
          <span className="label">Finished-goods value</span>
          <span className="value mono">{result.outputValue.format()}</span>
        </div>
        <div className="card stat">
          <span className="label">Output unit cost</span>
          <span className="value mono">
            {result.outputUnitCost.toDecimalValue().toString()} IQD/g
          </span>
        </div>
        <div className="card stat">
          <span className="label">Yield variance</span>
          <span
            className="value mono"
            style={{ color: result.yieldVarianceBase.isPositive() ? "var(--warn)" : "var(--ok)" }}
          >
            {result.yieldVarianceBase.isPositive() ? "−" : "+"}
            {result.yieldVarianceBase.abs().toString()} g
          </span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Raw materials consumed</h3>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th className="right">Qty (base)</th>
              <th className="right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {result.consumptions.map((c) => (
              <tr key={c.itemId}>
                <td>{batchItemName(c.itemId)}</td>
                <td className="right mono">−{c.baseQuantity.toString()}</td>
                <td className="right mono">{c.value.format()}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Finished output</strong>
              </td>
              <td className="right mono" style={{ color: "var(--ok)" }}>
                +{result.actualOutputBase.toString()} g
              </td>
              <td className="right mono">{result.outputValue.format()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  padding: "0 12px",
  fontSize: "1.1rem",
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  width: 200,
};
