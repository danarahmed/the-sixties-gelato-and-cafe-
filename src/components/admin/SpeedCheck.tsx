"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { measureDatabaseAction, saveSpeedSampleAction } from "@/lib/actions/speed";
import { deviceName } from "@/components/DeviceNote";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";

interface Call {
  name: string;
  ms: number | null;
}
interface Sample {
  id: string;
  at: string;
  deviceMs: number | null;
  databaseMs: number | null;
  calls: Call[];
  agent: string | null;
  note: string | null;
}
interface Measured {
  deviceMs: number | null;
  databaseMs: number | null;
  calls: Call[];
}

/** Slow is over a second; fair, over a third of one. */
function tone(ms: number | null): string {
  if (ms === null) return "muted";
  return ms > 1000 ? "red" : ms > 333 ? "orange" : "green";
}

/** The device's trip to the app and back: the fastest of five (the first wakes it). */
async function deviceTrip(): Promise<number | null> {
  const trips: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    try {
      const r = await fetch(`/api/ping?speed=${Date.now()}`, { cache: "no-store" });
      if (r.ok) trips.push(Math.round(performance.now() - t0));
    } catch {
      /* not reached: left out */
    }
  }
  return trips.length ? Math.min(...trips) : null;
}

export function SpeedCheck({ samples }: { samples: Sample[] }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ms = (n: number | null) => (n === null ? t("Not reached") : t("{n} ms", { n }));

  function measure() {
    setMsg(null);
    start(async () => {
      const deviceMs = await deviceTrip();
      const r = await measureDatabaseAction();
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMeasured({ deviceMs, databaseMs: r.data.databaseMs, calls: r.data.calls });
    });
  }

  function save() {
    if (!measured) return;
    start(async () => {
      const r = await saveSpeedSampleAction({
        ...measured,
        agent: deviceName(navigator.userAgent),
        note: note.trim() || null,
      });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        setNote("");
        router.refresh();
      }
    });
  }

  /** A measurement as plain text, to paste into a message. */
  const asText = (s: Sample) =>
    [
      `${t("Speed")} · ${new Date(s.at).toLocaleString()} · ${s.agent ?? ""}`,
      `${t("This device to the app")}: ${ms(s.deviceMs)}`,
      `${t("The app to the database")}: ${ms(s.databaseMs)}`,
      ...s.calls.map((c) => `${t(c.name)}: ${ms(c.ms)}`),
      s.note ? `${t("Note")}: ${s.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="speed">
      <div className="card grid" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-primary"
            onClick={measure}
            disabled={busy}
            data-testid="speed-measure"
          >
            {busy && !measured ? t("Measuring…") : t("Measure now")}
          </button>
        </div>
        {measured && (
          <>
            <table data-testid="speed-result">
              <tbody>
                <tr>
                  <td>{t("This device to the app")}</td>
                  <td className={`right mono ${tone(measured.deviceMs)}`}>
                    {ms(measured.deviceMs)}
                  </td>
                </tr>
                <tr>
                  <td>{t("The app to the database")}</td>
                  <td className={`right mono ${tone(measured.databaseMs)}`}>
                    {ms(measured.databaseMs)}
                  </td>
                </tr>
                {measured.calls.map((c) => (
                  <tr key={c.name} data-testid="speed-call">
                    <td>{t(c.name)}</td>
                    <td className={`right mono ${tone(c.ms)}`}>{ms(c.ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="grid" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {t("Where and when, and which screens felt slow")}
              </span>
              <input
                style={inputStyle}
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                aria-label={t("Where and when, and which screens felt slow")}
              />
            </label>
            <div className="row">
              <button type="button" onClick={save} disabled={busy} data-testid="speed-save">
                {t("Keep it")}
              </button>
            </div>
          </>
        )}
        <Notice msg={msg} />
      </div>

      <h2 style={{ margin: 0 }}>{t("Measurements kept")}</h2>
      {samples.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("Nothing kept yet.")}
        </p>
      ) : (
        samples.map((s) => (
          <div key={s.id} className="card grid" style={{ gap: 6 }} data-testid="speed-sample">
            <div
              className="row"
              style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <strong>{new Date(s.at).toLocaleString()}</strong>
              <span className="muted">{s.agent}</span>
              <button
                type="button"
                className="btn-soft"
                onClick={() => void navigator.clipboard?.writeText(asText(s))}
              >
                {t("Copy, to send")}
              </button>
            </div>
            <div className="muted" style={{ fontSize: ".85rem" }}>
              {t("This device to the app")}:{" "}
              <span className={tone(s.deviceMs)}>{ms(s.deviceMs)}</span> ·{" "}
              {t("The app to the database")}:{" "}
              <span className={tone(s.databaseMs)}>{ms(s.databaseMs)}</span>
            </div>
            {s.note && <div style={{ fontSize: ".85rem" }}>{s.note}</div>}
          </div>
        ))
      )}
    </div>
  );
}
