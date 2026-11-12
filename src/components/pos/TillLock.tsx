"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unlockTillAction } from "@/lib/actions/security";
import { signOutAction } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/I18nProvider";
import { inputStyle } from "@/components/ui";

/**
 * The till's lock (0099): after the café's minutes with nobody touching it,
 * the till covers itself and asks the person signed in for their PIN (their
 * clock PIN or their approval PIN). Anyone else signs out and in as
 * themselves, so no sale is ever rung up under another person's name. Off
 * (0 minutes) by default.
 */
export function TillLock({ minutes, name }: { minutes: number; name: string }) {
  const { t, msg: say } = useT();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const last = useRef(Date.now());

  useEffect(() => {
    if (!minutes) return;
    const touch = () => {
      if (!locked) last.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    const timer = window.setInterval(() => {
      if (!locked && Date.now() - last.current >= minutes * 60_000) setLocked(true);
    }, 5000);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      window.clearInterval(timer);
    };
  }, [minutes, locked]);

  if (!minutes || !locked) return null;

  function unlock() {
    setError(null);
    start(async () => {
      const r = await unlockTillAction(pin);
      setPin("");
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (!r.data.ok) {
        setError(r.data.error ? say(r.data.error) : t("That PIN is not right"));
        return;
      }
      last.current = Date.now();
      setLocked(false);
    });
  }

  return (
    <div className="till-lock" role="dialog" aria-modal="true" data-testid="till-lock">
      <div className="card grid" style={{ gap: 12, maxWidth: 360 }}>
        <h2 style={{ margin: 0 }}>{t("The till is locked")}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("{name}, type your PIN to go on. Not {name}? Sign out, and sign in as yourself.", {
            name,
          })}
        </p>
        <input
          style={inputStyle}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          onKeyDown={(e) => {
            if (e.key === "Enter") unlock();
          }}
          aria-label={t("Your PIN")}
          data-testid="till-lock-pin"
        />
        {error && (
          <p className="red" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={unlock}
            disabled={busy || pin.length < 4}
            data-testid="till-lock-go"
          >
            {t("Unlock")}
          </button>
          <form action={signOutAction}>
            <button type="submit" className="btn-soft">
              {t("auth.signOut")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
