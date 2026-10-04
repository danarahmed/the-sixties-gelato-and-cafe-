"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/I18nProvider";
import { dateTimeIn } from "@/lib/dates";
import { weekdayOf } from "@/lib/production";
import { Emblem, usePrintOnce } from "@/components/pos/PrintSlip";
import { Icon } from "@/components/Icon";
import { inputStyle } from "@/components/ui";

/** What a pan's label says of the batch it holds. */
export interface LabelBatch {
  batchNo: number;
  /** What is in the pan, in the reader's language. */
  name: string;
  /** What the batch made, as it was weighed: "4.8 kg", "2 Pans of 5 kg". */
  made: string;
  madeAt: string;
  useBy: string | null;
  place: string | null;
  madeBy: string | null;
  /** The batch's lot, as the stock knows it; none just after it is recorded. */
  lot?: string | null;
}

/**
 * Labels for a batch's pans, on the receipt printer (80 mm): what is in it, its
 * batch, when it was made and when it is to be used by, large and boxed, and
 * how much the batch made. One label a pan, each cut on its own; the freezer is
 * then used oldest first, and nothing past its use-by is sold by mistake.
 */
export function BatchLabels({
  batch,
  businessName,
  timezone,
  pans = 1,
}: {
  batch: LabelBatch;
  businessName: string;
  timezone: string;
  /** How many labels to start from: one a pan the batch filled. */
  pans?: number;
}) {
  const { t } = useT();
  const [count, setCount] = useState(String(pans));
  const [printing, setPrinting] = useState<number | null>(null);
  usePrintOnce(printing, () => setPrinting(null));
  const n = Math.min(20, Math.max(1, Math.floor(Number(count)) || 1));
  return (
    <div className="label-print" data-testid="batch-labels">
      <label className="label-count">
        <span>{t("Labels")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          style={{ ...inputStyle, width: 72 }}
          value={count}
          aria-label={t("How many labels")}
          onChange={(e) => setCount(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn-soft"
        data-testid="print-labels"
        onClick={() => setPrinting(n)}
      >
        <Icon name="tag" size={16} /> {t("Print {n} label(s)", { n })}
      </button>
      {printing !== null && (
        <LabelSlips
          batches={[{ batch, count: printing }]}
          businessName={businessName}
          timezone={timezone}
        />
      )}
    </div>
  );
}

/**
 * The labels of several batches printed at once: each batch's pans, one label
 * a pan, every one cut on its own (round five: a day's plan recorded in one go).
 */
export function PrintAllLabels({
  batches,
  businessName,
  timezone,
}: {
  batches: { batch: LabelBatch; count: number }[];
  businessName: string;
  timezone: string;
}) {
  const { t } = useT();
  const [printing, setPrinting] = useState<number | null>(null);
  usePrintOnce(printing, () => setPrinting(null));
  const n = batches.reduce((s, b) => s + b.count, 0);
  if (n === 0) return null;
  return (
    <div className="label-print" data-testid="plan-labels">
      <button
        type="button"
        className="btn-soft"
        data-testid="print-all-labels"
        onClick={() => setPrinting(n)}
      >
        <Icon name="tag" size={16} /> {t("Print {n} label(s)", { n })}
      </button>
      {printing !== null && (
        <LabelSlips batches={batches} businessName={businessName} timezone={timezone} />
      )}
    </div>
  );
}

/** The slips themselves, for the printer: each batch's labels, one a pan. */
function LabelSlips({
  batches,
  businessName,
  timezone,
}: {
  batches: { batch: LabelBatch; count: number }[];
  businessName: string;
  timezone: string;
}) {
  const { t, locale, dir } = useT();
  if (typeof document === "undefined") return null;
  const when = (iso: string) => (
    <>
      {t(weekdayOf(iso, timezone))} <bdi dir="ltr">{dateTimeIn(timezone, iso)}</bdi>
    </>
  );
  return createPortal(
    <div className="print-slip" dir={dir} lang={locale}>
      {batches.flatMap(({ batch, count }) =>
        Array.from({ length: count }, (_, i) => (
          <div key={`${batch.batchNo}-${i}`} className="slip sl-label" data-testid="pan-label">
            <div className="sl-label-head">
              <Emblem className="sl-label-emblem" />
              <span>{businessName}</span>
            </div>
            <div className="sl-label-name">{batch.name}</div>
            <div className="sl-label-batch">
              {t("Batch {no}", { no: batch.batchNo })}
              {count > 1 && <span> · {t("Pan {i} of {n}", { i: i + 1, n: count })}</span>}
            </div>
            <table className="sl-label-dates">
              <tbody>
                <tr>
                  <th>{t("Made")}</th>
                  <td>{when(batch.madeAt)}</td>
                </tr>
                {batch.useBy && (
                  <tr className="sl-label-useby">
                    <th>{t("Use by")}</th>
                    <td>{when(batch.useBy)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {!batch.useBy && <div className="sl-label-meta">{t("No use-by")}</div>}
            <div className="sl-label-meta">
              {t("The batch made {made}", { made: batch.made })}
              {batch.place ? ` · ${batch.place}` : ""}
              {batch.madeBy ? ` · ${batch.madeBy}` : ""}
            </div>
            {batch.lot && <div className="sl-label-lot">{batch.lot}</div>}
          </div>
        )),
      )}
    </div>,
    document.body,
  );
}
