"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { useT } from "@/lib/i18n/I18nProvider";
import { IQD, Money } from "@domain/money/money.js";
import { computeCountVariance } from "@domain/inventory/counting.js";
import { INVENTORY } from "@/lib/demo/data";

export default function CountPage() {
  const { t } = useT();
  const [itemId, setItemId] = useState(INVENTORY[0]!.itemId);
  const [counted, setCounted] = useState("");
  const [revealed, setRevealed] = useState(false);

  const item = INVENTORY.find((r) => r.itemId === itemId)!;
  const wac = {
    quantityBase: new Decimal(100000),
    totalValue: Money.of(item.unitCost * 100000, IQD),
  };

  const variance =
    revealed && counted !== ""
      ? computeCountVariance(
          {
            itemId: item.itemId,
            locationId: "branch-1",
            expectedBase: new Decimal(item.onHandBase),
            countedBase: new Decimal(counted),
          },
          wac,
          IQD,
        )
      : null;

  function reset(next: string) {
    setItemId(next);
    setCounted("");
    setRevealed(false);
  }

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 700 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.count")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <strong>Blind count:</strong> the expected quantity is hidden while you count. After
        approval the system posts a single adjustment movement (counted − expected) — it never
        overwrites history.
      </p>

      <div className="card">
        <label>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            Item
          </div>
          <select value={itemId} onChange={(e) => reset(e.target.value)} style={selStyle}>
            {INVENTORY.map((r) => (
              <option key={r.itemId} value={r.itemId}>
                {r.name} ({r.unit})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginTop: 14 }}>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            Counted quantity ({item.unit})
          </div>
          <input
            type="number"
            min={0}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="Enter what you physically counted"
            style={{ ...selStyle, width: 260 }}
          />
        </label>

        <div style={{ marginTop: 14 }}>
          {!revealed ? (
            <button
              className="btn-primary"
              disabled={counted === ""}
              onClick={() => setRevealed(true)}
            >
              Submit &amp; reveal variance (manager)
            </button>
          ) : (
            <button onClick={() => setRevealed(false)}>Re-count (hide expected)</button>
          )}
        </div>
      </div>

      {variance && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Variance</h3>
          <div className="deduction-row">
            <span className="muted">Expected (system)</span>
            <span className="mono">
              {variance.expectedBase.toString()} {item.unit}
            </span>
          </div>
          <div className="deduction-row">
            <span className="muted">Counted</span>
            <span className="mono">
              {variance.countedBase.toString()} {item.unit}
            </span>
          </div>
          <div className="deduction-row">
            <strong>Quantity variance</strong>
            <strong
              className="mono"
              style={{
                color: variance.quantityVarianceBase.isNegative() ? "var(--err)" : "var(--ok)",
              }}
            >
              {variance.quantityVarianceBase.isNegative() ? "" : "+"}
              {variance.quantityVarianceBase.toString()} {item.unit}
            </strong>
          </div>
          <div className="deduction-row">
            <span className="muted">Value variance</span>
            <span
              className="mono"
              style={{ color: variance.valueVariance.isNegative() ? "var(--err)" : "var(--ok)" }}
            >
              {variance.valueVariance.format()}
            </span>
          </div>
          {!variance.quantityVarianceBase.isZero() && (
            <p className="muted" style={{ fontSize: ".85rem" }}>
              On approval, posts a <code>count_adjustment</code> movement of{" "}
              <strong className="mono">
                {variance.quantityVarianceBase.toString()} {item.unit}
              </strong>{" "}
              — bringing the ledger to the counted quantity while preserving all history.
            </p>
          )}
          {variance.quantityVarianceBase.isZero() && (
            <p className="badge ok">No variance — nothing to post.</p>
          )}
        </div>
      )}
    </div>
  );
}

const selStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  padding: "0 12px",
  fontSize: "1rem",
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
};
