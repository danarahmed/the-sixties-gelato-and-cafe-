"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fmtQty } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { dirFor } from "@/lib/i18n/dictionaries";
import type { Tender } from "./model";

export interface PrintJob {
  /** A bill is handed over before payment; a receipt after it. */
  kind: "bill" | "receipt";
  title: string;
  channelLabel: string;
  lines: { name: string; qty: number; amount: number | null; note: string | null }[];
  total: number;
  tender?: Tender;
  received?: number | null;
  change?: number | null;
  reference?: string | null;
  journalNo?: number | null;
  /** The second and later prints of a bill say so. */
  printCount?: number;
  at: string;
  by: string;
}

const money = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * The slip for an 80 mm receipt printer (72 mm printable), or any printer the
 * till is connected to: everything else on the page is hidden while it
 * prints. The browser's print dialog chooses the printer; a till set up for
 * silent printing prints straight away (see the cashier guide).
 */
export function PrintSlip({
  job,
  businessName,
  timezone,
  onDone,
}: {
  job: PrintJob | null;
  businessName: string;
  timezone: string;
  onDone: () => void;
}) {
  const { t, locale } = useT();
  // Printed once per job, however often the till re-renders meanwhile.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!job) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done.current();
    };
    window.addEventListener("afterprint", finish);
    // Let the slip render before the print dialog takes its picture of the page.
    const timer = window.setTimeout(() => {
      window.print();
      window.setTimeout(finish, 500);
    }, 60);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
    };
  }, [job]);

  if (!job || typeof document === "undefined") return null;
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(job.at));

  return createPortal(
    <div className="print-slip" dir={dirFor(locale)} lang={locale}>
      <div className="ps-center ps-strong ps-big">{businessName}</div>
      <div className="ps-center ps-strong">
        {job.kind === "bill" ? t("print.bill") : t("print.receipt")}
      </div>
      {job.kind === "bill" && (job.printCount ?? 1) > 1 && (
        <div className="ps-center">
          {t("print.copy")} {job.printCount}
        </div>
      )}
      <div className="ps-rule" />
      <div className="ps-row">
        <span className="ps-strong">{job.title}</span>
        <span>{job.channelLabel}</span>
      </div>
      <div className="ps-row">
        <span>{when}</span>
        <span>{job.by}</span>
      </div>
      <div className="ps-rule" />
      {job.lines.map((l, i) => (
        <div key={i}>
          <div className="ps-row">
            <span>
              {fmtQty(l.qty)} × {l.name}
            </span>
            <span className="ps-num">{l.amount === null ? "—" : money(l.amount)}</span>
          </div>
          {l.note && <div className="ps-note">{l.note}</div>}
        </div>
      ))}
      <div className="ps-rule" />
      <div className="ps-row ps-strong ps-big">
        <span>{t("pos.total")}</span>
        <span className="ps-num">{money(job.total)} IQD</span>
      </div>
      {job.kind === "receipt" && job.tender && (
        <>
          <div className="ps-row">
            <span>{t(`pos.tender.${job.tender}`)}</span>
            <span className="ps-num">{money(job.received ?? job.total)}</span>
          </div>
          {job.change != null && job.change > 0 && (
            <div className="ps-row ps-strong">
              <span>{t("pos.changeDue")}</span>
              <span className="ps-num">{money(job.change)}</span>
            </div>
          )}
        </>
      )}
      <div className="ps-rule" />
      {job.kind === "receipt" ? (
        <div className="ps-center">
          {job.reference && `${t("print.sale")} ${job.reference}`}
          {job.journalNo != null && ` · ${t("pos.journal")} ${job.journalNo}`}
        </div>
      ) : (
        <div className="ps-center">{t("print.notPaid")}</div>
      )}
      <div className="ps-center ps-thanks">{t("print.thanks")}</div>
    </div>,
    document.body,
  );
}
