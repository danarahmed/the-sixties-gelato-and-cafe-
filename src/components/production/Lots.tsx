"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { setBatchUseByAction } from "@/lib/actions/production";
import { dateTimeIn, isoToLocalTime, localTimeToIso } from "@/lib/dates";
import { LOT_STATUS_LABEL, type LotStatus, type ProductionLot } from "@/lib/production";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { showNice, type UnitsOf } from "@/components/production/batchMath";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

const BADGE: Record<LotStatus, string> = {
  expired: "badge err",
  today: "badge warn",
  soon: "badge warn",
  good: "badge ok",
};

/**
 * What is in stock by batch (0046): each batch with some left, the one to be
 * used first first, and where it stands against its use-by. Sales, losses and
 * other batches take from them in that order; what is past its use-by last.
 */
export function ProductionLots({
  lots,
  items,
  timezone,
  canChange,
}: {
  lots: ProductionLot[];
  items: ({ id: string } & UnitsOf)[];
  timezone: string;
  /** A manager, who may change a batch's use-by. */
  canChange: boolean;
}) {
  const { t } = useT();
  const byId = new Map(items.map((i) => [i.id, i]));
  if (lots.length === 0)
    return (
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }} data-testid="lots-empty">
        {t("No batch has anything left in stock.")}
      </p>
    );
  return (
    <div className="tw">
      <table data-testid="lots">
        <thead>
          <tr>
            <th>{t("Batch")}</th>
            <th>{t("What")}</th>
            <th className="right">{t("Still in stock")}</th>
            <th>{t("Use by")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lots.map((l) => (
            <tr key={l.lotId} data-testid="lot-row" data-lot={l.lot} data-status={l.status}>
              <td className="mono">
                {l.batchId ? (
                  <Link href={`/production/batches/${l.batchId}`}>{l.batchNo ?? l.lot}</Link>
                ) : (
                  l.lot
                )}
              </td>
              <td>{l.item}</td>
              <td className="right mono">
                {showNice(new Decimal(l.left), byId.get(l.itemId), l.baseUnit)}
              </td>
              <td>
                <span className="mono" style={{ fontSize: ".85rem" }}>
                  {l.useBy ? dateTimeIn(timezone, l.useBy) : "—"}
                </span>{" "}
                <span className={BADGE[l.status]}>{t(LOT_STATUS_LABEL[l.status])}</span>
              </td>
              <td>
                {canChange && l.batchId && (
                  <SetUseBy batchId={l.batchId} useBy={l.useBy} timezone={timezone} compact />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A batch's use-by changed by a manager, with why: on the audit trail. */
export function SetUseBy({
  batchId,
  useBy,
  timezone,
  compact = false,
}: {
  batchId: string;
  useBy: string | null;
  timezone: string;
  /** Behind a button, as in a list. */
  compact?: boolean;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(!compact);
  const [when, setWhen] = useState(useBy ? isoToLocalTime(useBy, timezone) : "");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="change-use-by">
        {t("Change the use-by…")}
      </button>
    );

  function save() {
    setMsg(null);
    const iso = localTimeToIso(when, timezone);
    if (!iso) {
      setMsg({ ok: false, text: t("Enter a date and a time") });
      return;
    }
    start(async () => {
      const r = await op.run("setBatchUseBy", (key) =>
        setBatchUseByAction({ batchId, useBy: iso, reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("Saved, and on the audit trail.") });
      setReason("");
      if (compact) setOpen(false);
      router.refresh();
    });
  }

  return (
    <div
      style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}
      data-testid="use-by-form"
    >
      <input
        type="datetime-local"
        aria-label={t("Use by")}
        style={inputStyle}
        value={when}
        onChange={(e) => setWhen(e.target.value)}
      />
      <input
        aria-label={t("Why the use-by changes")}
        style={inputStyle}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("Why? e.g. it set soft, sell it today")}
      />
      <button className="btn-primary" disabled={busy || !reason.trim()} onClick={save}>
        {busy ? t("Saving…") : t("Save the use-by")}
      </button>
      {compact && (
        <button type="button" onClick={() => setOpen(false)} disabled={busy}>
          {t("Cancel")}
        </button>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
