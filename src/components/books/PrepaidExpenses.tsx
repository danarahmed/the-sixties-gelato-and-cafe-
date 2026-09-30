"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelPrepaidExpenseAction, releasePrepaidAction } from "@/lib/actions/books";
import { dateIn } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { stillAhead, type PrepaidRow } from "@/lib/prepaid";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

/**
 * The café's prepaid expenses (0060): what each paid, for which months, the
 * shares posted and what is still to come. The months that have come and
 * whose share is not posted yet are posted with one press (the dashboard and
 * the month's close ask for it); one entered in error is cancelled, its
 * payment and every share posted reversed today.
 */
export function PrepaidExpenses({
  rows,
  timezone,
  canRelease,
  canCancel,
}: {
  rows: PrepaidRow[];
  timezone: string;
  canRelease: boolean;
  canCancel: boolean;
}) {
  const op = useOperation();
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const due = rows.reduce((s, p) => s + (p.cancelledAt ? 0 : p.due), 0);
  const toCome = rows.reduce((s, p) => s + stillAhead(p), 0);

  function release() {
    setNote(null);
    start(async () => {
      const r = await op.run("releasePrepaid", (key) => releasePrepaidAction(key));
      if (r.ok) {
        setNote({
          ok: true,
          text: t("{n} month(s)' share posted as an expense of its month.", {
            n: r.data.released,
          }),
        });
        router.refresh();
      } else setNote({ ok: false, text: r.error });
    });
  }

  return (
    <section className="panel" id="prepaid" data-testid="prepaid">
      <div className="panel-h">
        <h3>{t("Prepaid Expenses")}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {t("Paid ahead: each month takes its share as an expense of that month")}
        </span>
      </div>
      <div
        className="panel-b"
        style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
      >
        <span data-testid="prepaid-to-come">
          {t("Still ahead: {amount}", { amount: fmtIQD(toCome) })}
        </span>
        {due > 0 && (
          <span className="badge warn">
            {t("{n} month(s) due to take their share", { n: due })}
          </span>
        )}
        {due > 0 && canRelease && (
          <button
            className="btn-primary"
            onClick={release}
            disabled={busy}
            data-testid="prepaid-release"
          >
            {busy ? t("Posting…") : t("Release what is due ({n})", { n: due })}
          </button>
        )}
        <OperationStatus op={op} />
        <Notice msg={note} />
      </div>
      <div className="tw">
        <table className="stack-table">
          <thead>
            <tr>
              <th>{t("Paid on")}</th>
              <th>{t("Narration")}</th>
              <th>{t("Account")}</th>
              <th>{t("Months")}</th>
              <th>{t("Posted")}</th>
              <th className="right">{t("Paid")}</th>
              <th className="right">{t("Still ahead")}</th>
              {canCancel && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={p.cancelledAt ? "muted" : undefined}
                data-testid="prepaid-row"
              >
                <td className="when">{dateIn(timezone, new Date(p.createdAt))}</td>
                <td data-label={t("Narration")}>
                  {p.description}
                  {p.journalNo !== null && (
                    <span className="faint mono" style={{ marginInlineStart: 6 }}>
                      #{p.journalNo}
                    </span>
                  )}
                  {p.cancelledAt && (
                    <>
                      <span className="badge warn" style={{ marginInlineStart: 6 }}>
                        {t("cancelled")}
                      </span>
                      {p.cancelReason && (
                        <div className="faint" style={{ fontSize: ".74rem" }}>
                          {p.cancelReason}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="muted" data-label={t("Account")}>
                  {p.accountCode} {say(p.accountName)}
                </td>
                <td className="when" data-label={t("Months")}>
                  {p.firstMonth === p.lastMonth ? (
                    <bdi>{p.firstMonth}</bdi>
                  ) : (
                    <>
                      <bdi>{p.firstMonth}</bdi> — <bdi>{p.lastMonth}</bdi>
                    </>
                  )}
                </td>
                <td data-label={t("Posted")}>
                  {t("{n} of {m}", { n: p.released, m: p.months })}
                  {p.reversed > 0 && (
                    <span className="badge" style={{ marginInlineStart: 6 }}>
                      {t("{n} reversed by hand", { n: p.reversed })}
                    </span>
                  )}
                  {!p.cancelledAt && p.due > 0 && (
                    <span className="badge warn" style={{ marginInlineStart: 6 }}>
                      {t("{n} due", { n: p.due })}
                    </span>
                  )}
                </td>
                <td className="right money" data-label={t("Paid")}>
                  {fmtIQD(p.amount)}
                </td>
                <td className="right money" data-label={t("Still ahead")}>
                  {fmtIQD(stillAhead(p))}
                </td>
                {canCancel && (
                  <td className="right">
                    {!p.cancelledAt && (
                      <CancelPrepaid
                        prepaidId={p.id}
                        description={p.description}
                        onDone={() => router.refresh()}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One entered in error, cancelled with the reason why (the accountant's). */
function CancelPrepaid({
  prepaidId,
  description,
  onDone,
}: {
  prepaidId: string;
  description: string;
  onDone: () => void;
}) {
  const op = useOperation();
  const { t, msg } = useT();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const small = { minHeight: 26, padding: "0 8px", fontSize: ".72rem" };
  const why = t("Why cancel {what}?", { what: description });
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={small}
        title={t("Entered in error: its payment and every share posted are reversed today")}
      >
        {t("Cancel")}
      </button>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "end",
      }}
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={why}
        aria-label={why}
        style={{ minHeight: 26, width: 180, fontSize: ".78rem" }}
        maxLength={300}
        autoFocus
      />
      <button
        className="btn-primary"
        disabled={busy || !reason.trim()}
        style={small}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await op.run("cancelPrepaid", (key) =>
              cancelPrepaidExpenseAction({ prepaidId, reason }, key),
            );
            if (r.ok) {
              setOpen(false);
              onDone();
            } else setErr(r.error);
          })
        }
      >
        {busy ? "…" : t("Confirm")}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} style={small}>
        {t("Keep")}
      </button>
      {err && (
        <span className="red" style={{ fontSize: ".72rem", flexBasis: "100%", textAlign: "end" }}>
          {msg(err)}
        </span>
      )}
      <OperationStatus op={op} />
    </span>
  );
}
