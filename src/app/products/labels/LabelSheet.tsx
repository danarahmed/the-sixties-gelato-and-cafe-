"use client";

import { useState } from "react";
import { code128Bars } from "@/lib/barcode";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";

interface LabelItem {
  variantId: string;
  name: string;
  price: number | null;
  barcode: string;
  weighed: boolean;
}

/** A barcode drawn as bars (Code 128), its digits under it. */
export function Barcode({ code, height = 40 }: { code: string; height?: number }) {
  const { bars, width } = code128Bars(code);
  return (
    <svg
      viewBox={`0 0 ${width} ${height + 12}`}
      className="barcode"
      role="img"
      aria-label={code}
      preserveAspectRatio="none"
    >
      <rect x="0" y="0" width={width} height={height + 12} fill="#fff" />
      {bars.map(([x, w], i) => (
        <rect key={i} x={x} y="0" width={w} height={height} fill="#000" />
      ))}
      <text x={width / 2} y={height + 10} textAnchor="middle" fontSize="9" fontFamily="monospace">
        {code}
      </text>
    </svg>
  );
}

/** How many of each label, then printed: the sheet is what the printer gets. */
export function LabelSheet({
  businessName,
  items,
  only,
}: {
  businessName: string;
  items: LabelItem[];
  only: string | null;
}) {
  const { t } = useT();
  const [count, setCount] = useState<Record<string, number>>(
    Object.fromEntries(
      items.map((i) => [i.variantId, only === null || only === i.variantId ? 1 : 0]),
    ),
  );
  const labels = items.flatMap((i) => Array.from({ length: count[i.variantId] ?? 0 }, () => i));
  return (
    <>
      <section className="card grid no-print" style={{ gap: 8 }} data-testid="label-choice">
        <p className="muted" style={{ margin: 0 }}>
          {t("How many labels of each, then Print.")}
        </p>
        {items.map((i) => (
          <label key={i.variantId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={200}
              value={count[i.variantId] ?? 0}
              onChange={(e) =>
                setCount((c) => ({
                  ...c,
                  [i.variantId]: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                }))
              }
              style={{ width: 72 }}
              aria-label={t("Labels of {name}", { name: i.name })}
              data-testid="label-count"
            />
            <span dir="auto">{i.name}</span>
            <code className="muted" dir="ltr">
              {i.barcode}
            </code>
          </label>
        ))}
        <div>
          <button
            type="button"
            className="btn-primary"
            disabled={labels.length === 0}
            onClick={() => window.print()}
            data-testid="label-print"
          >
            <Icon name="print" /> {t("Print {n} labels", { n: labels.length })}
          </button>
        </div>
      </section>
      <div className="label-sheet" data-testid="label-sheet">
        {labels.map((i, k) => (
          <div key={k} className="label" data-testid="label">
            <div className="label-shop">{businessName}</div>
            <div className="label-name" dir="auto">
              {i.name}
            </div>
            {i.price !== null && (
              <div className="label-price">
                {fmtIQD(i.price)}
                {i.weighed ? ` / ${t("kg")}` : ""}
              </div>
            )}
            <Barcode code={i.barcode} />
          </div>
        ))}
      </div>
    </>
  );
}
