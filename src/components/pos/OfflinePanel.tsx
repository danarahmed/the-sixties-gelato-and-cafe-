"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { Icon } from "@/components/Icon";
import { Modal } from "./Dialogs";
import type { OfflineSale } from "./offline";

/**
 * The till's word on selling without internet (0073), beside the drawer: no
 * connection, and how many sales it keeps; sending them; or those the
 * database refused, waiting for a manager. Nothing when all is well.
 */
export function OfflineStrip({
  connected,
  waiting,
  attention,
  sending,
  onOpen,
  bills = 0,
}: {
  connected: boolean;
  waiting: number;
  attention: number;
  sending: boolean;
  onOpen: () => void;
  /** Bills changed offline, waiting to be saved (0082). */
  bills?: number;
}) {
  const { t } = useT();
  if (connected && waiting === 0 && attention === 0 && bills === 0) return null;
  const text =
    attention > 0
      ? t("{n} offline sale(s) need a manager", { n: String(attention) })
      : !connected
        ? waiting > 0
          ? t("No internet · {n} sale(s) kept on this till", { n: String(waiting) })
          : t("No internet · selling offline")
        : sending
          ? t("Sending {n} sale(s) made offline…", { n: String(waiting) })
          : t("{n} sale(s) made offline waiting to send", { n: String(waiting) });
  return (
    <button
      type="button"
      className={`strip-chip offline-chip${attention > 0 ? " bad" : " waiting"}`}
      onClick={onOpen}
      data-testid="offline-strip"
      data-waiting={waiting}
      data-attention={attention}
      aria-live="polite"
    >
      <Icon name={attention > 0 ? "alert" : "clock"} size={16} /> {text}
      {bills > 0 && attention === 0 && (
        <> · {t("{n} bill(s) kept on this till", { n: String(bills) })}</>
      )}
    </button>
  );
}

/**
 * The sales this till keeps: each with when it was made, by whom, what it
 * came to and, for one the database refused, why. A manager sends one again,
 * records one whose price has changed at today's price, or, as a last resort,
 * takes one off the till (its cash stays in the drawer, over its count).
 */
export function OfflineDialog({
  sales,
  canRemove,
  sending,
  timezone,
  priceChanged,
  onSettle,
  onClose,
  bills = [],
  onBill,
}: {
  /** Bills changed offline (0082): sent again, or a manager drops the changes. */
  bills?: { id: string; title: string; keptAt: string; items: number; error: string | null }[];
  onBill?: (id: string, how: "retry" | "remove") => void;
  sales: OfflineSale[];
  canRemove: boolean;
  sending: boolean;
  timezone: string;
  priceChanged: (error: string | null) => boolean;
  onSettle: (key: string, how: "retry" | "today" | "remove") => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [removing, setRemoving] = useState<string | null>(null);
  const time = (iso: string) => dateTimeIn(timezone, iso);
  return (
    <Modal label={t("Sales made offline")} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>{t("Sales made offline")}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        {t(
          "Each is sent by itself as soon as the internet is back, never twice. One the database refuses waits here for a manager.",
        )}
      </p>
      {sales.length === 0 ? (
        <p data-testid="offline-none">{t("Every sale made offline has been sent.")}</p>
      ) : (
        <ul className="offline-list" data-testid="offline-list">
          {sales.map((s) => {
            const single = s.payments.length === 1 ? s.payments[0] : undefined;
            const atToday =
              priceChanged(s.error) && single !== undefined && single.type !== "other";
            return (
              <li
                key={s.key}
                className={s.state === "attention" ? "offline-row bad" : "offline-row"}
                data-testid="offline-row"
                data-state={s.state}
              >
                <div className="offline-row-top">
                  <strong>{t("Offline {n}", { n: String(s.no) })}</strong>
                  <span className="muted">
                    <span className="mono" dir="ltr">
                      {time(s.soldAt)}
                    </span>{" "}
                    · <span dir="auto">{s.soldByName}</span>
                  </span>
                  <strong className="mono">{fmtIQD(Number(s.expectedNet || 0))}</strong>
                </div>
                {s.state === "waiting" ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {sending ? t("Sending…") : t("Waiting for the internet")}
                  </p>
                ) : (
                  <>
                    <p className="red" style={{ margin: 0 }} data-testid="offline-error">
                      {s.error ? t(s.error) : null}
                    </p>
                    <div className="offline-actions">
                      <button type="button" onClick={() => onSettle(s.key, "retry")}>
                        {t("Send again")}
                      </button>
                      {atToday && (
                        <button
                          type="button"
                          onClick={() => onSettle(s.key, "today")}
                          data-testid="offline-today"
                        >
                          {t("Record at today's price")}
                        </button>
                      )}
                      {canRemove &&
                        (removing === s.key ? (
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => onSettle(s.key, "remove")}
                            data-testid="offline-remove-yes"
                          >
                            {t("Take it off: its cash shows over in the drawer's count")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRemoving(s.key)}
                            data-testid="offline-remove"
                          >
                            {t("Take it off this till")}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {bills.length > 0 && (
        <>
          <h4 style={{ marginBlock: "14px 6px" }}>{t("Bills changed offline")}</h4>
          <ul className="offline-list" data-testid="kept-list">
            {bills.map((b) => (
              <li
                key={b.id}
                className={b.error ? "offline-row bad" : "offline-row"}
                data-testid="kept-row"
              >
                <div className="offline-row-top">
                  <strong>{b.title}</strong>
                  <span className="muted mono" dir="ltr">
                    {time(b.keptAt)}
                  </span>
                  <span className="muted">{t("{n} item(s)", { n: String(b.items) })}</span>
                </div>
                {b.error === null ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {sending ? t("Sending…") : t("Waiting for the internet")}
                  </p>
                ) : (
                  <>
                    <p className="red" style={{ margin: 0 }}>
                      {t(b.error)}
                    </p>
                    <div className="offline-actions">
                      <button type="button" onClick={() => onBill?.(b.id, "retry")}>
                        {t("Send again")}
                      </button>
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => onBill?.(b.id, "remove")}
                          data-testid="kept-remove"
                        >
                          {t("Drop these changes")}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <div style={{ marginBlockStart: 12 }}>
        <button type="button" onClick={onClose}>
          {t("pos.close")}
        </button>
      </div>
    </Modal>
  );
}
