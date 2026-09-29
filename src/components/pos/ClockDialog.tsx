"use client";

import { useEffect, useState, useTransition } from "react";
import { clockAction, clockBoardAction } from "@/lib/actions/staff";
import { clockTime, splitMinutes, type ClockAnswer, type ClockPerson } from "@/lib/staff";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Modal } from "./Dialogs";

/**
 * Clocking in and out at the till (0049): each person who works at this branch
 * chooses their name and types their PIN. Those in are shown since when; the
 * others, their shift today. A wrong PIN is counted by the database, and too
 * many pause clocking by PIN until a manager sets a new one on Staff.
 */
export function ClockDialog({ timezone, onClose }: { timezone: string; onClose: () => void }) {
  const op = useOperation();
  const { t, msg: say } = useT();
  const [people, setPeople] = useState<ClockPerson[] | null>(null);
  const [who, setWho] = useState<ClockPerson | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ answer: ClockAnswer; direction: "in" | "out" } | null>(null);
  const [busy, start] = useTransition();

  function load() {
    start(async () => {
      const r = await clockBoardAction();
      if (!r.ok) {
        setError(r.error);
        setPeople([]);
        return;
      }
      setPeople(r.data);
    });
  }

  useEffect(load, []);

  const direction: "in" | "out" = who?.inSince ? "out" : "in";
  const hours = (minutes: number) => {
    const { h, m } = splitMinutes(minutes);
    return m === 0
      ? t("{h} h", { h: String(h) })
      : t("{h} h {m} min", { h: String(h), m: String(m) });
  };

  function clock() {
    if (!who || !/^\d{4,8}$/.test(pin)) return;
    setError(null);
    start(async () => {
      const r = await op.run("clock", (key) =>
        clockAction({ employeeId: who.employeeId, pin, direction }, key),
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (!r.data.ok) {
        setError(r.data.error ?? t("That PIN is not right"));
        setPin("");
        return;
      }
      setDone({ answer: r.data, direction });
      setWho(null);
      setPin("");
      load();
    });
  }

  return (
    <Modal label={t("Clock in or out")} busy={busy} onClose={onClose}>
      <div className="grid" style={{ gap: 12 }} data-testid="clock-dialog">
        <h3 style={{ margin: 0 }}>🕐 {t("Clock in or out")}</h3>

        {done && (
          <div
            className="badge ok"
            style={{ whiteSpace: "normal" }}
            role="status"
            data-testid="clock-done"
          >
            {done.direction === "in"
              ? t("{name} is clocked in, at {time}.", {
                  name: done.answer.name ?? "",
                  time: clockTime(done.answer.clockIn, timezone),
                })
              : t("{name} is clocked out, at {time}: {hours} today.", {
                  name: done.answer.name ?? "",
                  time: clockTime(done.answer.clockOut, timezone),
                  hours: hours(done.answer.minutes ?? 0),
                })}
            {done.direction === "in" && (done.answer.lateMinutes ?? 0) > 0 && (
              <> {t("{minutes} min late.", { minutes: String(done.answer.lateMinutes) })}</>
            )}
            {done.direction === "out" && (done.answer.earlyMinutes ?? 0) > 0 && (
              <>
                {" "}
                {t("{minutes} min before the shift ends.", {
                  minutes: String(done.answer.earlyMinutes),
                })}
              </>
            )}
          </div>
        )}

        {who === null ? (
          people === null ? (
            <p className="muted" style={{ margin: 0 }}>
              …
            </p>
          ) : people.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {t("Nobody works at this branch yet: a manager adds the people on Staff.")}
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
              data-testid="clock-people"
            >
              {people.map((p) => (
                <button
                  key={p.employeeId}
                  type="button"
                  className={p.inSince ? "btn-primary" : undefined}
                  style={{ textAlign: "start", padding: "10px 12px" }}
                  disabled={busy || !p.hasPin}
                  onClick={() => {
                    setWho(p);
                    setPin("");
                    setError(null);
                    setDone(null);
                  }}
                  data-testid="clock-person"
                  data-name={p.name}
                  data-in={p.inSince ? "yes" : "no"}
                >
                  <b>{p.name}</b>
                  <br />
                  <span style={{ fontSize: ".8rem" }}>
                    {p.inSince
                      ? t("In since {time}", { time: clockTime(p.inSince, timezone) })
                      : !p.hasPin
                        ? t("No PIN yet: a manager sets one on Staff")
                        : p.shiftStarts
                          ? t("Shift {from}–{to}", {
                              from: clockTime(p.shiftStarts, timezone),
                              to: clockTime(p.shiftEnds, timezone),
                            })
                          : t("Not on the schedule today")}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            <b>
              {direction === "in"
                ? t("{name}: clock in", { name: who.name })
                : t("{name}: clock out, in since {time}", {
                    name: who.name,
                    time: clockTime(who.inSince, timezone),
                  })}
            </b>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                aria-label={t("Your PIN")}
                className="pin-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={8}
                placeholder="PIN" // i18n-ignore: PIN is PIN in every language
                value={pin}
                onChange={(e) => setPin(normaliseNumber(e.target.value).replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && clock()}
                style={{ width: 130 }}
                data-testid="clock-pin"
              />
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !/^\d{4,8}$/.test(pin)}
                onClick={clock}
                data-testid="clock-confirm"
              >
                {busy ? "…" : direction === "in" ? t("Clock in") : t("Clock out")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setWho(null);
                  setPin("");
                  setError(null);
                }}
              >
                {t("Someone else")}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="red" style={{ margin: 0 }} role="alert" data-testid="clock-error">
            {say(error)}
          </p>
        )}
        <OperationStatus op={op} />
        <div>
          <button type="button" onClick={onClose} disabled={busy}>
            {t("pos.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
