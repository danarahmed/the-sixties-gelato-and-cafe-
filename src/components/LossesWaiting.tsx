"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewLossAction } from "@/lib/actions/stock";
import type { LossWaiting } from "@/lib/losses";
import { fmtIQD, fmtQty, movementLabel } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

/**
 * The losses saved to wait for a manager (0040), oldest first. A manager other
 * than the one who recorded it approves each, or reverses one that did not
 * happen: the stock goes back and its journal is reversed, with a reason. A
 * loss recorded whole (0048) is one row, an item or a product as it was given.
 */
export function LossesWaiting({
  losses,
  myId,
  timezone,
}: {
  losses: LossWaiting[];
  myId: string;
  timezone: string;
}) {
  const { t } = useT();
  if (losses.length === 0) return null;
  return (
    <section className="panel" id="losses-waiting" data-testid="losses-waiting">
      <div className="panel-h">
        <h3>{t("Losses waiting for approval")}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {t("Approve each, or reverse one that did not happen")}
        </span>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("When")}</th>
              <th>{t("Item")}</th>
              <th className="right">{t("Quantity lost")}</th>
              <th>{t("What happened")}</th>
              <th className="right">{t("Value")}</th>
              <th>{t("Why")}</th>
              <th>{t("Recorded by")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {losses.map((l) => (
              <LossRow
                key={l.movementId}
                loss={l}
                mine={l.recordedById === myId}
                timezone={timezone}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LossRow({ loss, mine, timezone }: { loss: LossWaiting; mine: boolean; timezone: string }) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function review(decision: "approve" | "reverse") {
    setMsg(null);
    start(async () => {
      const r = await op.run(`reviewLoss:${loss.movementId}`, (key) =>
        reviewLossAction(
          { movementId: loss.movementId, decision, reason: decision === "reverse" ? reason : null },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <tr data-testid="loss-waiting" data-item={loss.item}>
        <td className="mono muted" style={{ fontSize: ".8rem" }}>
          {dateTimeIn(timezone, loss.at)}
        </td>
        <td>
          {loss.item}
          {loss.batchNo !== null && (
            <span className="muted" style={{ fontSize: ".8rem" }}>
              {" "}
              · {t("Batch {n}", { n: loss.batchNo })}
            </span>
          )}
        </td>
        <td className="right mono">
          {loss.unit ? `${fmtQty(loss.qty)} ${loss.unit}` : `×${fmtQty(loss.qty)}`}
        </td>
        <td>
          {t(movementLabel(loss.kind))}
          {loss.account && (
            <span className="muted mono" style={{ fontSize: ".75rem" }}>
              {" "}
              {loss.account}
            </span>
          )}
        </td>
        <td className="right money">{loss.value === null ? "—" : fmtIQD(loss.value)}</td>
        <td>{loss.reason ? say(loss.reason) : "—"}</td>
        <td>{loss.recordedBy ?? "—"}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          {mine ? (
            <span className="muted" style={{ fontSize: ".8rem" }}>
              {t("Someone else approves a loss you recorded")}
            </span>
          ) : (
            <>
              <button type="button" onClick={() => review("approve")} disabled={busy}>
                {t("Approve")}
              </button>{" "}
              <button type="button" onClick={() => setReversing((v) => !v)} disabled={busy}>
                {t("Reverse…")}
              </button>
            </>
          )}
        </td>
      </tr>
      {(reversing || msg || op.checking) && (
        <tr>
          <td colSpan={8}>
            {reversing && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                  aria-label={t("Why is it reversed? (required)")}
                  placeholder={t("Why is it reversed? (required)")}
                  value={reason}
                  maxLength={300}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => review("reverse")}
                  disabled={busy || !reason.trim()}
                >
                  {t("Reverse the loss: the stock goes back")}
                </button>
              </div>
            )}
            <OperationStatus op={op} />
            <Notice msg={msg} />
          </td>
        </tr>
      )}
    </>
  );
}
