"use client";

import { useEffect, useRef, useState } from "react";
import { shopCodeAction } from "@/lib/actions/clock";
import { clockUrl, spacedCode, type ShopCode as Code } from "@/lib/clock";
import { useT } from "@/lib/i18n/I18nProvider";
import { QrCode } from "@/components/QrCode";
import { Icon } from "@/components/Icon";

/** How long a code is shown: half a minute. */
const WINDOW_SECONDS = 30;

/**
 * The shop's code (0068), on a clock screen: a square to scan and its 6
 * digits, new every half-minute. Each is asked of the database as the last
 * one ends, by the server's clock, so a till whose own clock is wrong still
 * shows the right code. A phone that scans it opens its clock with the code.
 */
export function ShopCode({ full = false }: { full?: boolean }) {
  const { t, msg: say } = useT();
  const [code, setCode] = useState<Code | null>(null);
  const [left, setLeft] = useState(0);
  const [origin, setOrigin] = useState("");
  // When the code shown ends, on this device's steady clock.
  const ends = useRef(0);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    let stopped = false;
    let next: number | undefined;
    async function load() {
      const r = await shopCodeAction().catch(() => null);
      if (stopped) return;
      if (!r || !r.ok) {
        // No answer: the code on screen stays until it ends, then the screen asks again.
        next = window.setTimeout(load, 4000);
        return;
      }
      setCode(r.data);
      if (r.data.ok) {
        ends.current = performance.now() + r.data.left * 1000;
        setLeft(r.data.left);
        next = window.setTimeout(load, Math.max(400, r.data.left * 1000 + 300));
      }
    }
    void load();
    const tick = window.setInterval(() => {
      if (ends.current > 0)
        setLeft(Math.max(0, Math.ceil((ends.current - performance.now()) / 1000)));
    }, 250);
    return () => {
      stopped = true;
      window.clearTimeout(next);
      window.clearInterval(tick);
    };
  }, []);

  if (code === null) {
    return (
      <div className={`shop-code${full ? " full" : ""}`} data-testid="shop-code" aria-busy="true">
        <p className="muted" style={{ margin: 0 }}>
          …
        </p>
      </div>
    );
  }
  if (!code.ok) {
    return (
      <div className={`shop-code${full ? " full" : ""}`} data-testid="shop-code">
        <p className="red" style={{ margin: 0 }} role="alert" data-testid="shop-code-error">
          {say(code.error)}
        </p>
      </div>
    );
  }
  const share = Math.min(1, left / WINDOW_SECONDS);
  return (
    <div className={`shop-code${full ? " full" : ""}`} data-testid="shop-code">
      <p className="shop-code-say">
        <Icon name="clock" size={full ? 22 : 18} /> {t("Scan with your phone to clock in or out")}
      </p>
      <div className="shop-code-square">
        {origin && (
          <QrCode
            text={clockUrl(origin, code.code)}
            size={full ? 340 : 200}
            label={t("The shop's code to scan")}
            testId="shop-code-qr"
          />
        )}
      </div>
      <div
        className="shop-code-digits"
        dir="ltr"
        data-testid="shop-code-digits"
        data-code={code.code}
      >
        {spacedCode(code.code)}
      </div>
      <div className="shop-code-time" aria-hidden="true">
        <span style={{ inlineSize: `${share * 100}%` }} />
      </div>
      <p className="muted shop-code-left" aria-live="off">
        {t("A new code in {n} s", { n: left })} · {code.name}
        {code.location ? ` · ${code.location}` : ""}
      </p>
    </div>
  );
}
