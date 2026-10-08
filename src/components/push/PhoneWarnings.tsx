"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/ui";
import { useOperation } from "@/components/useOperation";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  removePushDeviceAction,
  savePushDeviceAction,
  sendTestWarningAction,
  thisPhoneAction,
} from "@/lib/actions/push";

type Msg = { ok: boolean; text: string } | null;
type State = "checking" | "unsupported" | "blocked" | "off" | "on";

/** The key a phone is given, in the form its browser takes (base64url to bytes). */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded =
    base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** This phone's registration of the app, if it has one, without waiting for ever. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const ready = navigator.serviceWorker.ready;
  const late = new Promise<null>((r) => setTimeout(() => r(null), 4000));
  return (
    (await Promise.race([ready, late])) ?? (await navigator.serviceWorker.getRegistration()) ?? null
  );
}

/**
 * Warnings on this phone (0072, round eleven), on My account: whoever sees the
 * dashboard's warnings turns them on on a phone — all, or the urgent ones —
 * sends it a test, or turns them off. On an iPhone the app must first be on
 * the Home Screen; a phone that has blocked notifications is told where to
 * allow them.
 */
export function PhoneWarnings({
  on,
  publicKey,
  canSend,
}: {
  on: boolean;
  publicKey: string | null;
  canSend: boolean;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [state, setState] = useState<State>("checking");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (live) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (live) setState("blocked");
        return;
      }
      const reg = await registration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) {
        if (live) setState(reg ? "off" : "unsupported");
        return;
      }
      const r = await thisPhoneAction(sub.endpoint);
      if (!live) return;
      setEndpoint(sub.endpoint);
      if (r.ok && r.data.on) {
        setUrgentOnly(r.data.urgentOnly);
        setState("on");
      } else setState("off");
    })().catch(() => live && setState("unsupported"));
    return () => {
      live = false;
    };
  }, []);

  function save(urgent: boolean, sub: PushSubscription) {
    const j = sub.toJSON();
    return op.run("phone", (key) =>
      savePushDeviceAction(
        {
          endpoint: sub.endpoint,
          p256dh: j.keys?.p256dh ?? "",
          auth: j.keys?.auth ?? "",
          locale,
          urgentOnly: urgent,
        },
        key,
      ),
    );
  }

  function turnOn() {
    setMsg(null);
    start(async () => {
      try {
        const asked = await Notification.requestPermission();
        if (asked !== "granted") {
          setState(asked === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await registration();
        if (!reg || !publicKey) {
          setState("unsupported");
          return;
        }
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(publicKey),
          }));
        const r = await save(urgentOnly, sub);
        if (!r.ok) {
          setMsg({ ok: false, text: r.error });
          return;
        }
        setEndpoint(sub.endpoint);
        setState("on");
        setMsg({ ok: true, text: t("Warnings will come to this phone.") });
        router.refresh();
      } catch {
        setMsg({
          ok: false,
          text: t("This phone's browser would not take warnings. Try again, or another browser."),
        });
      }
    });
  }

  function chooseUrgent(urgent: boolean) {
    setMsg(null);
    // The box follows the press at once, and goes back if the change is refused.
    const was = urgentOnly;
    setUrgentOnly(urgent);
    start(async () => {
      const reg = await registration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) {
        setUrgentOnly(was);
        setState("off");
        return;
      }
      const r = await save(urgent, sub);
      if (r.ok) setMsg({ ok: true, text: t("Saved.") });
      else {
        setUrgentOnly(was);
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  function test() {
    if (!endpoint) return;
    setMsg(null);
    start(async () => {
      const r = await sendTestWarningAction(endpoint);
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else
        setMsg({
          ok: true,
          text: r.data.canSend
            ? t("A test is on its way: it comes within a minute.")
            : t("The test waits: the database cannot send yet (see Settings)."),
        });
    });
  }

  function turnOff() {
    if (!endpoint) return;
    setMsg(null);
    start(async () => {
      const r = await removePushDeviceAction(endpoint);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      try {
        const reg = await registration();
        await (await reg?.pushManager.getSubscription())?.unsubscribe();
      } catch {
        // The database no longer sends to it: that is what counts.
      }
      setState("off");
      setMsg({ ok: true, text: t("Warnings will no longer come to this phone.") });
    });
  }

  return (
    <section
      className="card phone-warnings"
      data-testid="phone-warnings"
      data-state={on ? state : "cafe-off"}
    >
      <h3 style={{ marginTop: 0 }}>{t("Warnings on this phone")}</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: ".88rem" }}>
        {t(
          "The warnings the dashboard shows under Needs you, sent to this phone as they come, in your language: what is short, late, below zero or out of the ordinary. Each is sent once, within about five minutes.",
        )}
      </p>
      {!on ? (
        <p className="muted" data-testid="phone-warnings-cafe-off" style={{ margin: 0 }}>
          {t(
            "The owner has not turned phone warnings on for the café yet (Settings → Phone warnings).",
          )}
        </p>
      ) : state === "checking" ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("Checking this phone…")}
        </p>
      ) : state === "unsupported" ? (
        <p className="muted" data-testid="phone-warnings-unsupported" style={{ margin: 0 }}>
          {t(
            "This browser cannot take warnings. On an iPhone, first add the app to the Home Screen (Share → Add to Home Screen), then open it from there and come back here.",
          )}
        </p>
      ) : state === "blocked" ? (
        <p className="muted" data-testid="phone-warnings-blocked" style={{ margin: 0 }}>
          {t(
            "Notifications are blocked for this app on this phone. Allow them in the browser's or the phone's settings for this site, then come back here.",
          )}
        </p>
      ) : state === "off" ? (
        <div className="grid" style={{ gap: 10 }}>
          <label style={{ fontSize: ".9rem", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={urgentOnly}
              onChange={(e) => setUrgentOnly(e.target.checked)}
            />
            {t("Only the urgent (red) ones")}
          </label>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={turnOn}
            data-testid="phone-warnings-on"
          >
            {t("Turn on warnings on this phone")}
          </button>
        </div>
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          <p
            className="badge ok"
            style={{ margin: 0, justifySelf: "start" }}
            data-testid="phone-warnings-is-on"
          >
            {urgentOnly ? t("On: the urgent ones only") : t("On: every warning")}
          </p>
          <label style={{ fontSize: ".9rem", display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={urgentOnly}
              disabled={busy}
              onChange={(e) => chooseUrgent(e.target.checked)}
            />
            {t("Only the urgent (red) ones")}
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={test} data-testid="phone-warnings-test">
              {t("Send a test")}
            </button>
            <button disabled={busy} onClick={turnOff} data-testid="phone-warnings-off">
              {t("Turn off on this phone")}
            </button>
          </div>
        </div>
      )}
      <Notice msg={msg} />
      {on && !canSend && (
        <p className="muted" style={{ marginBottom: 0, fontSize: ".82rem" }}>
          {t("The database cannot send yet: nothing will come until it can (see Settings).")}
        </p>
      )}
    </section>
  );
}
