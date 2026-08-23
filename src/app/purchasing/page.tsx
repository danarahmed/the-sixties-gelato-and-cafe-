"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { useT } from "@/lib/i18n/I18nProvider";
import { IQD, Money } from "@domain/money/money.js";
import { UnitSystem, Quantity, type UnitDefinition } from "@domain/units/units.js";
import {
  landedUnitCost,
  applyReceipt,
  averageUnitCost,
  type WacState,
} from "@domain/costing/wac.js";

const EACH: UnitDefinition = { code: "each", dimension: "count", factorToBase: "1", label: "Each" };
const CARTON: UnitDefinition = {
  code: "carton_1000",
  dimension: "count",
  factorToBase: "1000",
  label: "Carton (1,000)",
};
const ML: UnitDefinition = { code: "ml", dimension: "volume", factorToBase: "1", label: "ml" };
const L: UnitDefinition = { code: "L", dimension: "volume", factorToBase: "1000", label: "Litre" };
const CASE: UnitDefinition = {
  code: "case_12x1L",
  dimension: "volume",
  factorToBase: "12000",
  label: "Case (12 × 1 L)",
};
const G: UnitDefinition = { code: "g", dimension: "mass", factorToBase: "1", label: "g" };
const KG: UnitDefinition = { code: "kg", dimension: "mass", factorToBase: "1000", label: "kg" };

interface PItem {
  id: string;
  name: string;
  baseUnit: string;
  units: UnitSystem;
  purchaseUnits: string[];
  state: WacState;
}

const ITEMS: PItem[] = [
  {
    id: "straw",
    name: "Straw",
    baseUnit: "each",
    units: new UnitSystem("each", [EACH, CARTON]),
    purchaseUnits: ["carton_1000", "each"],
    state: { quantityBase: new Decimal(4979), totalValue: Money.of(4979 * 20, IQD) },
  },
  {
    id: "milk",
    name: "Milk",
    baseUnit: "ml",
    units: new UnitSystem("ml", [ML, L, CASE]),
    purchaseUnits: ["case_12x1L", "L", "ml"],
    state: { quantityBase: new Decimal(57000), totalValue: Money.of(57000 * 2, IQD) },
  },
  {
    id: "coffee_beans",
    name: "Coffee beans",
    baseUnit: "g",
    units: new UnitSystem("g", [G, KG]),
    purchaseUnits: ["kg", "g"],
    state: { quantityBase: new Decimal(18560), totalValue: Money.of(18560 * 40, IQD) },
  },
];

export default function PurchasingPage() {
  const { t } = useT();
  const [itemId, setItemId] = useState("straw");
  const item = ITEMS.find((i) => i.id === itemId)!;
  const [unit, setUnit] = useState(item.purchaseUnits[0]!);
  const [qty, setQty] = useState("5");
  const [goods, setGoods] = useState("90000");
  const [freight, setFreight] = useState("2000");
  const [rebate, setRebate] = useState("0");

  const result = useMemo(() => {
    try {
      const q = new Decimal(qty || 0);
      if (q.lessThanOrEqualTo(0)) return null;
      const baseQty = Quantity.of(q, unit).toBase(item.units).value;
      const { landedValue, unitCost } = landedUnitCost({
        quantityBase: baseQty,
        goodsValue: Money.of(goods || 0, IQD),
        allocatedFreight: Money.of(freight || 0, IQD),
        allocatedRebate: Money.of(rebate || 0, IQD),
      });
      const before = averageUnitCost(item.state);
      const after = applyReceipt(item.state, { quantityBase: baseQty, value: landedValue });
      return {
        baseQty,
        landedValue,
        unitCost,
        before,
        afterState: after,
        afterAvg: averageUnitCost(after),
      };
    } catch {
      return null;
    }
  }, [item, unit, qty, goods, freight, rebate]);

  function pickItem(id: string) {
    const it = ITEMS.find((i) => i.id === id)!;
    setItemId(id);
    setUnit(it.purchaseUnits[0]!);
  }

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 760 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.purchasing")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        Receive goods in a <strong>purchase unit</strong> (carton, case, kg). The engine converts to
        the base unit, folds in freight and rebates as <strong>landed cost</strong>, and recomputes
        the moving weighted-average cost.
      </p>

      <div className="card">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end" }}>
          <Field label="Item">
            <select value={itemId} onChange={(e) => pickItem(e.target.value)} style={sel}>
              {ITEMS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purchase unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} style={sel}>
              {item.purchaseUnits.map((u) => (
                <option key={u} value={u}>
                  {item.units.unit(u).label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input style={sel} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Goods value (IQD)">
            <input style={sel} value={goods} onChange={(e) => setGoods(e.target.value)} />
          </Field>
          <Field label="Freight (IQD)">
            <input style={sel} value={freight} onChange={(e) => setFreight(e.target.value)} />
          </Field>
          <Field label="Rebate (IQD)">
            <input style={sel} value={rebate} onChange={(e) => setRebate(e.target.value)} />
          </Field>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Goods receipt result</h3>
          <div className="deduction-row">
            <span className="muted">Received in base units</span>
            <span className="mono" style={{ color: "var(--ok)" }}>
              +{result.baseQty.toString()} {item.baseUnit}
            </span>
          </div>
          <div className="deduction-row">
            <span className="muted">Landed value (goods + freight − rebate)</span>
            <span className="mono">{result.landedValue.format()}</span>
          </div>
          <div className="deduction-row">
            <strong>Landed unit cost</strong>
            <strong className="mono">
              {result.unitCost.toDecimalValue().toString()} IQD/{item.baseUnit}
            </strong>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
          <div className="deduction-row">
            <span className="muted">Avg cost before</span>
            <span className="mono">
              {result.before.toDecimalValue().toString()} IQD/{item.baseUnit}
            </span>
          </div>
          <div className="deduction-row">
            <span className="muted">Avg cost after (WAC)</span>
            <span className="mono">
              {result.afterAvg.toDecimalValue().toString()} IQD/{item.baseUnit}
            </span>
          </div>
          <div className="deduction-row">
            <span className="muted">New on-hand</span>
            <span className="mono">
              {result.afterState.quantityBase.toString()} {item.baseUnit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <div className="muted" style={{ fontSize: ".85rem" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

const sel: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  padding: "0 12px",
  fontSize: "1rem",
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  width: 150,
};
