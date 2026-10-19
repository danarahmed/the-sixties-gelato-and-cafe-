"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { useT } from "@/lib/i18n/I18nProvider";
import { fmtIQD } from "@/lib/format";
import { fmtWeight, parseWeight } from "@/lib/weight";
import { Modal } from "./Dialogs";

/** The weights a bakery sells most, one tap each. */
const QUICK = [100, 250, 500, 1000];

/**
 * How much a size sold by weight weighs (round seventeen, 0075): typed in
 * grams, or kilos, or one of the usual weights in one tap; what it comes to
 * at the kilo's price, as the database will round it.
 */
export function WeightSheet({
  name,
  perKg,
  decimals,
  initialKg = null,
  onAdd,
  onClose,
}: {
  name: string;
  /** The price of a kilo on this channel; null when there is none. */
  perKg: number | null;
  decimals: number;
  initialKg?: number | null;
  onAdd: (kg: number) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [unit, setUnit] = useState<"g" | "kg">("g");
  const [text, setText] = useState(initialKg !== null ? String(Math.round(initialKg * 1000)) : "");
  const kg = parseWeight(text, unit);
  const amount =
    kg && perKg !== null
      ? kg.times(perKg).toDecimalPlaces(decimals, Decimal.ROUND_HALF_EVEN).toNumber()
      : null;
  const add = (w: Decimal | null) => {
    if (w) onAdd(w.toNumber());
  };
  return (
    <Modal label={t("How much does it weigh?")} onClose={onClose}>
      <div className="weight-sheet" data-testid="weight-sheet">
        <h3 style={{ marginTop: 0 }}>
          <span dir="auto">{name}</span>
        </h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {perKg === null ? t("pos.noPrice") : t("{price} a kilo", { price: fmtIQD(perKg) })}
        </p>
        <div className="weight-quick">
          {QUICK.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => add(parseWeight(String(g), "g"))}
              data-testid="weight-quick"
            >
              {fmtWeight(g / 1000, { g: t("g"), kg: t("kg") })}
            </button>
          ))}
        </div>
        <form
          className="weight-entry"
          onSubmit={(e) => {
            e.preventDefault();
            add(kg);
          }}
        >
          <input
            autoFocus
            inputMode="decimal"
            value={text}
            aria-label={t("Weight")}
            onChange={(e) => setText(e.target.value)}
            data-testid="weight-input"
          />
          <div className="seg" role="radiogroup" aria-label={t("Unit")}>
            {(["g", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                className={unit === u ? "active" : ""}
                onClick={() => setUnit(u)}
              >
                {u === "g" ? t("grams") : t("kilos")}
              </button>
            ))}
          </div>
        </form>
        <p className="weight-total" aria-live="polite">
          {kg === null
            ? text.trim()
              ? t("A weight is from 1 g to 1,000 kg, to the gram")
              : t("Type the weight, or tap one above.")
            : amount !== null
              ? t("{kg} kg comes to {amount}", { kg: kg.toString(), amount: fmtIQD(amount) })
              : null}
        </p>
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={kg === null}
            onClick={() => add(kg)}
            data-testid="weight-add"
          >
            {t("Add")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
