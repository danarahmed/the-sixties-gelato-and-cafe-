"use client";

import { useState, useTransition } from "react";
import { saleReceiptAction } from "@/lib/actions/reprint";
import { PrintSlip, type PrintJob } from "@/components/pos/PrintSlip";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * "Print receipt again" on Orders: the sale's receipt as the database
 * recorded it, marked COPY, for a customer who lost theirs.
 */
export function ReprintReceipt({
  orderId,
  businessName,
  timezone,
}: {
  orderId: string;
  businessName: string;
  timezone: string;
}) {
  const { t, msg } = useT();
  const [busy, start] = useTransition();
  const [job, setJob] = useState<PrintJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="linklike"
        disabled={busy}
        data-testid="reprint-receipt"
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await saleReceiptAction(orderId);
            if (!r.ok) setError(r.error);
            else setJob({ ...r.data, title: r.data.title || t("pos.quickSale") });
          })
        }
      >
        {t("Print receipt again")}
      </button>
      {error && (
        <div className="red" role="alert" style={{ fontSize: ".8rem" }}>
          {msg(error)}
        </div>
      )}
      <PrintSlip
        slips={job ? [job] : null}
        businessName={businessName}
        timezone={timezone}
        onDone={() => setJob(null)}
      />
    </>
  );
}
