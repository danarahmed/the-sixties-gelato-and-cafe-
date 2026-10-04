"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Emblem, usePrintOnce } from "@/components/pos/PrintSlip";
import { useT } from "@/lib/i18n/I18nProvider";

export interface DaySlipRow {
  label: string;
  value: string;
}

/** A part of the slip: its title, and its rows. */
export interface DaySlipPart {
  key: string;
  title: string;
  rows: DaySlipRow[];
}

/** The day's close on the receipt printer, in words the page has already put in the reader's language. */
export interface DaySlipData {
  businessName: string;
  /** "The day's close". */
  kind: string;
  /** The day, when it was printed, the place and who printed it. */
  meta: DaySlipRow[];
  /** The day's net sales, written large. */
  total: DaySlipRow | null;
  parts: DaySlipPart[];
  checksTitle: string;
  /** The steps of the close, each done or not, in a sentence. */
  checks: { done: boolean; text: string }[];
  /** Lines to sign on: "Closed by", "Checked by". */
  sign: string[];
}

/**
 * The day's close, for the receipt printer the till prints its checks on
 * (round six): a press prints a slip, 72 mm wide, to keep with the cash —
 * what the day sold and how it was paid, the drawers' counts, what sold the
 * most, each step of the close done or not, and lines to sign. Everything on
 * it is on the page above, in the reader's language.
 */
export function DaySlipButton({ slip, label }: { slip: DaySlipData; label: string }) {
  const [printing, setPrinting] = useState(false);
  const { locale, dir } = useT();
  usePrintOnce(printing ? slip : null, () => setPrinting(false));
  return (
    <>
      <button
        type="button"
        className="btn-soft"
        onClick={() => setPrinting(true)}
        data-testid="eod-slip"
      >
        {label}
      </button>
      {printing &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="print-slip" dir={dir} lang={locale} data-testid="eod-slip-paper">
            <section className="slip day-slip">
              <header className="sl-head">
                <Emblem />
                <div className="sl-brand">{slip.businessName}</div>
                <div className="sl-kind">
                  <span>{slip.kind}</span>
                </div>
              </header>
              <div className="sl-meta">
                {slip.meta.map((m) => (
                  <div key={m.label}>
                    <span>{m.label}</span>
                    <strong>{m.value}</strong>
                  </div>
                ))}
              </div>
              {slip.total && (
                <div className="sl-total" data-testid="eod-slip-total">
                  <span>{slip.total.label}</span>
                  <span>{slip.total.value}</span>
                </div>
              )}
              {slip.parts.map((p) => (
                <div key={p.key} className="sl-part" data-part={p.key}>
                  <div className="sl-part-title">{p.title}</div>
                  {p.rows.map((r, i) => (
                    <div key={i} className="sl-row">
                      <span>{r.label}</span>
                      <span>{r.value}</span>
                    </div>
                  ))}
                </div>
              ))}
              {slip.checks.length > 0 && (
                <div className="sl-part" data-part="checks">
                  <div className="sl-part-title">{slip.checksTitle}</div>
                  {slip.checks.map((c, i) => (
                    <div key={i} className="sl-check" data-done={c.done}>
                      <span aria-hidden="true">{c.done ? "✓" : "✗"}</span>
                      <span>{c.text}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="sl-sign">
                {slip.sign.map((s) => (
                  <div key={s}>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
