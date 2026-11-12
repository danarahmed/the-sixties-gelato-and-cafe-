"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLotUseByAction } from "@/lib/actions/useBy";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { fmtQty, unitName } from "@/lib/format";
import { USE_BY_STATUS_LABEL, type UseByLot, type UseByStatus } from "@/lib/useBy";

const BADGE: Record<UseByStatus, string> = {
  expired: "badge bad",
  today: "badge warn",
  soon: "badge warn",
  good: "badge",
};

/**
 * Every lot at the place with a use-by (0098), the batches' and the
 * deliveries', the nearest first; a manager changes one with a reason (the
 * pack read again, a date mistyped), on the audit trail.
 */
export function UseByLots({ lots, canEdit }: { lots: UseByLot[]; canEdit: boolean }) {
  const { t } = useT();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="panel" id="use-by" data-testid="use-by-lots">
      <div className="panel-h">
        <h3>{t("Use-by")}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {t("What is here with a use-by, the nearest first: sales take it in this order.")}
        </span>
      </div>
      {lots.length === 0 ? (
        <div className="panel-b">
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
            {t("Nothing here has a use-by yet.")}
          </p>
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Item")}</th>
                <th>{t("From")}</th>
                <th>{t("Use by")}</th>
                <th className="right">{t("Left")}</th>
                <th>{t("State")}</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.lotId} data-testid="use-by-lot" data-status={l.status}>
                  <td>{l.item}</td>
                  <td className="mono muted" style={{ fontSize: ".8rem" }}>
                    {l.kind === "batch"
                      ? t("Batch {no}", { no: l.batchNo ?? l.lot })
                      : t("Delivered {day}", { day: l.cameOn ?? "—" })}
                  </td>
                  <td className="mono">{l.useByOn ?? "—"}</td>
                  <td className="right mono">
                    {fmtQty(l.left)} {unitName(l.unit, t)}
                  </td>
                  <td>
                    <span className={BADGE[l.status]}>{t(USE_BY_STATUS_LABEL[l.status])}</span>
                  </td>
                  {canEdit && (
                    <td>
                      {editing === l.lotId ? (
                        <EditUseBy lot={l} onDone={() => setEditing(null)} />
                      ) : (
                        <button
                          type="button"
                          className="btn-soft"
                          onClick={() => setEditing(l.lotId)}
                          data-testid="use-by-edit"
                        >
                          {t("Change")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EditUseBy({ lot, onDone }: { lot: UseByLot; onDone: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [day, setDay] = useState(lot.useByOn ?? "");
  const [reason, setReason] = useState("");

  function save() {
    setMsg(null);
    if (!day) {
      setMsg({ ok: false, text: t("Give the new use-by") });
      return;
    }
    if (!reason.trim()) {
      setMsg({ ok: false, text: t("Say why the use-by changes") });
      return;
    }
    start(async () => {
      const r = await op.run(`lotUseBy:${lot.lotId}`, (key) =>
        setLotUseByAction({ lotId: lot.lotId, useBy: day, reason }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 6, minWidth: 220 }}>
      <input
        type="date"
        style={inputStyle}
        value={day}
        onChange={(e) => setDay(e.target.value)}
        aria-label={t("Use by")}
      />
      <input
        style={inputStyle}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("Why it changes")}
        aria-label={t("Why it changes")}
        maxLength={300}
      />
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? t("Saving…") : t("Save")}
        </button>
        <button type="button" onClick={onDone} disabled={busy}>
          {t("Cancel")}
        </button>
        <OperationStatus op={op} />
      </div>
      <Notice msg={msg} />
    </div>
  );
}
