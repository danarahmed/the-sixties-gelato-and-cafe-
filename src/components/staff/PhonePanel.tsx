"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkPhoneStartAction, phoneLinkedAction, unlinkPhoneAction } from "@/lib/actions/clock";
import { linkUrl, secondsLeft, type LinkedPhone, type PhoneLink } from "@/lib/clock";
import { dateTimeIn } from "@/lib/dates";
import { clockTime } from "@/lib/staff";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { QrCode } from "@/components/QrCode";
import { Icon } from "@/components/Icon";

type Msg = { ok: boolean; text: string } | null;

/**
 * A person's own phone (0068), on their row on Staff. A manager shows a square
 * that the person scans with their phone's camera, then presses Link this
 * phone on it: from then on that phone clocks them in and out, and the panel
 * says so as soon as it happens. A phone lost or changed is unlinked, with why.
 */
export function PhonePanel({
  employeeId,
  name,
  phone,
  timezone,
  onClose,
}: {
  employeeId: string;
  name: string;
  /** Their phone, when one is linked. */
  phone: LinkedPhone | null;
  timezone: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const [link, setLink] = useState<PhoneLink | null>(null);
  const [left, setLeft] = useState(0);
  const [origin, setOrigin] = useState("");
  // When the phone they had was linked, if any: a later one is the phone just linked.
  const before = useRef<string | null>(phone?.linkedAt ?? null);
  const [justLinked, setJustLinked] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, start] = useTransition();

  const makeLink = useCallback(() => {
    setMsg(null);
    setJustLinked(false);
    start(async () => {
      const r = await linkPhoneStartAction({ employeeId });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setLink(r.data);
      setLeft(secondsLeft(r.data.until, Date.now()));
    });
  }, [employeeId]);

  useEffect(() => setOrigin(window.location.origin), []);
  // No phone yet: the square is shown at once, nothing more to press.
  useEffect(() => {
    if (!phone) makeLink();
  }, [phone, makeLink]);

  // While the square is shown: the time it has left, and whether the phone has opened it.
  useEffect(() => {
    if (!link || justLinked) return;
    const tick = window.setInterval(() => setLeft(secondsLeft(link.until, Date.now())), 1000);
    const ask = window.setInterval(async () => {
      const r = await phoneLinkedAction({ employeeId }).catch(() => null);
      if (r?.ok && r.data.linkedAt && r.data.linkedAt !== before.current) {
        before.current = r.data.linkedAt;
        setJustLinked(true);
      }
    }, 2500);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(ask);
    };
  }, [link, justLinked, employeeId]);

  useEffect(() => {
    if (justLinked) router.refresh();
  }, [justLinked, router]);

  function unlink() {
    setMsg(null);
    start(async () => {
      const r = await unlinkPhoneAction({ employeeId, reason });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setUnlinking(false);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="phone-panel" data-testid="phone-panel">
      {justLinked ? (
        <div className="phone-panel-done" role="status" data-testid="phone-panel-linked">
          <Icon name="check" size={24} />
          <span>{t("Linked: {name}'s phone clocks them in and out now.", { name })}</span>
          <button type="button" onClick={onClose}>
            {t("Done")}
          </button>
        </div>
      ) : link ? (
        <div className="phone-panel-link">
          <div className="phone-panel-square">
            {origin && (
              <QrCode
                text={linkUrl(origin, link.key)}
                size={190}
                label={t("A square to link {name}'s phone", { name })}
                testId="phone-link-qr"
              />
            )}
          </div>
          <div className="grid" style={{ gap: 8 }}>
            <b>{t("{name}: scan this with your own phone's camera", { name })}</b>
            <ol className="phone-panel-steps">
              <li>{t("Open the camera on your phone and point it at the square.")}</li>
              <li>{t("Open the link it shows, and press Link this phone.")}</li>
            </ol>
            {left > 0 ? (
              <span className="muted" style={{ fontSize: ".85rem" }} data-testid="phone-link-left">
                {t("The square works once, until {time}.", {
                  time: clockTime(link.until, timezone),
                })}{" "}
                <span className="phone-panel-wait">{t("Waiting for the phone…")}</span>
              </span>
            ) : (
              <span className="warn-text" style={{ fontSize: ".85rem" }}>
                {t("This square is too old.")}{" "}
                <button type="button" onClick={makeLink} disabled={busy}>
                  {t("Make a new one")}
                </button>
              </span>
            )}
            <input
              style={{ ...inputStyle, minHeight: 36, fontSize: ".8rem" }}
              readOnly
              dir="ltr"
              value={origin ? linkUrl(origin, link.key) : ""}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t("The link, to send to their phone")}
              data-testid="phone-link-url"
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={onClose} disabled={busy}>
                {t("Close")}
              </button>
            </div>
          </div>
        </div>
      ) : phone ? (
        <div className="grid" style={{ gap: 8 }}>
          <span>
            <Icon name="phone" size={16} />{" "}
            {t("Their phone is linked since {when}.", {
              when: dateTimeIn(timezone, phone.linkedAt).slice(0, 10),
            })}{" "}
            {phone.lastUsedAt && (
              <span className="muted">
                {t("Last used {when}.", { when: dateTimeIn(timezone, phone.lastUsedAt).slice(5) })}
              </span>
            )}
          </span>
          {unlinking ? (
            <div className="clock-screen-remove">
              <input
                style={{ ...inputStyle, minHeight: 38 }}
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
                aria-label={t("Why the phone is no longer theirs")}
                placeholder={t("e.g. They lost it")}
                data-testid="phone-unlink-reason"
              />
              <button
                type="button"
                className="btn-primary"
                disabled={busy || reason.trim() === ""}
                onClick={unlink}
                data-testid="phone-unlink-confirm"
              >
                {t("Unlink the phone")}
              </button>
              <button type="button" onClick={() => setUnlinking(false)} disabled={busy}>
                {t("Cancel")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={makeLink} disabled={busy} data-testid="phone-relink">
                <Icon name="qr" size={16} /> {t("Link a new phone")}
              </button>
              <button
                type="button"
                onClick={() => setUnlinking(true)}
                disabled={busy}
                data-testid="phone-unlink"
              >
                {t("Unlink…")}
              </button>
              <button type="button" onClick={onClose} disabled={busy}>
                {t("Close")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          …
        </p>
      )}
      <Notice msg={msg} />
    </div>
  );
}
