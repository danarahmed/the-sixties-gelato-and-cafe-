"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockByPhoneAction } from "@/lib/actions/clock";
import { CODE_DIGITS, readCode, type PhoneClockAnswer, type PhoneStatus } from "@/lib/clock";
import { clockTime, splitMinutes } from "@/lib/staff";
import { latinDigits } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

/**
 * Clocking in or out on your own phone (0068). Scanning the shop's code opens
 * this with the code in hand: one press, and it is done. Opened without one,
 * it asks for the 6 digits the shop's screen shows. The phone's key, kept
 * since a manager linked it, says whose phone this is; nobody types a PIN.
 */
export function PhoneClock({
  status,
  scanned,
}: {
  /** Null: the database is not ready for it yet. */
  status: PhoneStatus | null;
  /** The code the square carried, if the phone came by scanning it. */
  scanned: string | null;
}) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const op = useOperation();
  const [typed, setTyped] = useState("");
  const [askDigits, setAskDigits] = useState(scanned === null);
  const [answer, setAnswer] = useState<{ a: PhoneClockAnswer; direction: "in" | "out" } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (status === null) {
    return (
      <Card icon="clock" title={t("The clock is not ready yet")}>
        <p className="muted">
          {t("The café's database needs its update before phones can clock in.")}
        </p>
      </Card>
    );
  }
  if (!status.linked) {
    return (
      <Card icon="phone" title={t("This phone is not linked yet")} testId="phone-unlinked">
        <p className="muted">
          {t(
            "A manager links it on Staff: they show you a square, and you scan it with this phone's camera. Then this phone clocks you in and out.",
          )}
        </p>
      </Card>
    );
  }
  if (!status.works) {
    return (
      <Card icon="phone" title={status.name} testId="phone-clock">
        <p className="red" role="alert">
          {say(`${status.name} does not work here now`)}
        </p>
      </Card>
    );
  }

  const tz = status.timezone;
  const isIn = status.inSince !== null;
  const direction: "in" | "out" = isIn ? "out" : "in";
  const code = askDigits ? readCode(typed) : scanned;
  const hours = (minutes: number) => {
    const { h, m } = splitMinutes(minutes);
    return m === 0
      ? t("{h} h", { h: String(h) })
      : t("{h} h {m} min", { h: String(h), m: String(m) });
  };

  function clock() {
    if (!code) return;
    setError(null);
    start(async () => {
      const r = await op.run(`phone-clock:${direction}`, (key) =>
        clockByPhoneAction({ code, direction }, key),
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (!r.data.ok) {
        setError(r.data.error ?? t("That code has changed: scan the shop's code again"));
        // A scanned code that has run out: the digits on the screen now will do.
        setAskDigits(true);
        setTyped("");
        return;
      }
      setAnswer({ a: r.data, direction });
      setTyped("");
      // The code is spent: the address forgets it, and the page reads the phone again.
      router.replace("/clock");
      router.refresh();
    });
  }

  return (
    <Card
      icon="phone"
      title={status.name}
      sub={status.title ?? status.business}
      testId="phone-clock"
    >
      <p className={`phone-clock-state${isIn ? " in" : ""}`} data-testid="phone-clock-state">
        <span className="dot" aria-hidden="true" />
        {isIn
          ? t("In since {time}, at {place}", {
              time: clockTime(status.inSince, tz),
              place: status.inAt ?? "",
            })
          : t("Not clocked in")}
      </p>

      {answer && (
        <div className="phone-clock-done" role="status" data-testid="phone-clock-done">
          <Icon name="check" size={28} />
          <div>
            {answer.direction === "in"
              ? t("{name} is clocked in, at {time}.", {
                  name: answer.a.name ?? status.name,
                  time: clockTime(answer.a.clockIn, tz),
                })
              : t("{name} is clocked out, at {time}: {hours} today.", {
                  name: answer.a.name ?? status.name,
                  time: clockTime(answer.a.clockOut, tz),
                  hours: hours(answer.a.minutes ?? 0),
                })}
            {answer.direction === "in" && (answer.a.lateMinutes ?? 0) > 0 && (
              <> {t("{minutes} min late.", { minutes: String(answer.a.lateMinutes) })}</>
            )}
            {answer.direction === "out" && (answer.a.earlyMinutes ?? 0) > 0 && (
              <>
                {" "}
                {t("{minutes} min before the shift ends.", {
                  minutes: String(answer.a.earlyMinutes),
                })}
              </>
            )}
          </div>
        </div>
      )}

      {askDigits && (
        <div className="grid" style={{ gap: 6 }}>
          <p style={{ margin: 0 }}>
            {t("Scan the code on the shop's clock screen with this phone's camera.")}
          </p>
          <label className="muted" style={{ fontSize: ".85rem" }} htmlFor="phone-clock-code">
            {t("Or type the 6 digits it shows")}
          </label>
          <input
            id="phone-clock-code"
            className="phone-clock-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={CODE_DIGITS + 1}
            value={typed}
            onChange={(e) => setTyped(latinDigits(e.target.value).replace(/[^0-9 ]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && clock()}
            placeholder="000 000" // i18n-ignore: digits, the same in every language
            data-testid="phone-clock-code"
          />
        </div>
      )}

      <button
        type="button"
        className={`btn-primary phone-clock-go${isIn ? " out" : ""}`}
        disabled={busy || !code}
        onClick={clock}
        data-testid="phone-clock-go"
        data-direction={direction}
      >
        <Icon name="clock" size={22} /> {busy ? "…" : isIn ? t("Clock out") : t("Clock in")}
      </button>

      {error && (
        <p className="red" style={{ margin: 0 }} role="alert" data-testid="phone-clock-error">
          {say(error)}
        </p>
      )}
      <OperationStatus op={op} />
    </Card>
  );
}

/** The page's one card, the width of a phone, in the café's warm style. */
function Card({
  icon,
  title,
  sub,
  testId,
  children,
}: {
  icon: "phone" | "clock";
  title: string;
  sub?: string | null;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="phone-clock" data-testid={testId}>
      <div className="phone-clock-head">
        <span className="phone-clock-mark" aria-hidden="true">
          <Icon name={icon} size={26} />
        </span>
        <div>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
