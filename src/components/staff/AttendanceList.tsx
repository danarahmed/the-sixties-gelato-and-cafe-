"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAttendanceAction,
  cancelAttendanceAction,
  correctAttendanceAction,
} from "@/lib/actions/staff";
import {
  SOURCE_LABEL,
  clockTime,
  splitMinutes,
  type AttendanceDay,
  type AttendanceRecord,
} from "@/lib/staff";
import { dateTimeIn, isoToLocalTime, localTimeToIso } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

/** "8 h 10 min", in the reader's language. */
export function useHours(): (minutes: number) => string {
  const { t } = useT();
  return (minutes: number) => {
    const { h, m } = splitMinutes(minutes);
    return h === 0
      ? t("{m} min", { m: String(m) })
      : t("{h} h {m} min", { h: String(h), m: String(m) });
  };
}

/**
 * The week's hours (0049): each day someone had hours on the schedule or
 * worked, as scheduled and as clocked, how late, how early, absent, and what
 * they worked over a day's hours; then each record of hours, with who added
 * or corrected it and why. A manager corrects, adds or cancels one, saying why.
 */
export function AttendanceList({
  days,
  records,
  people,
  timezone,
  canEdit,
}: {
  days: AttendanceDay[];
  records: AttendanceRecord[];
  people: { id: string; name: string }[];
  timezone: string;
  canEdit: boolean;
}) {
  const { t } = useT();
  const hours = useHours();
  const [open, setOpen] = useState<{ what: "correct" | "cancel"; id: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const at = (iso: string | null) => (iso ? dateTimeIn(timezone, iso).slice(5) : "—");

  return (
    <div className="grid" style={{ gap: 12 }}>
      {days.length === 0 ? (
        <p className="muted" style={{ margin: 0 }} data-testid="days-empty">
          {t("Nobody had hours on the schedule or clocked in these days.")}
        </p>
      ) : (
        <div className="tw">
          <table className="stack-table" data-testid="attendance-days">
            <thead>
              <tr>
                <th>{t("Day")}</th>
                <th>{t("Who")}</th>
                <th>{t("Hours on the schedule")}</th>
                <th>{t("Clocked")}</th>
                <th className="right">{t("Worked")}</th>
                <th>{t("Notes")}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr
                  key={`${d.employeeId}-${d.day}`}
                  data-testid="attendance-day"
                  data-name={d.name}
                  data-day={d.day}
                >
                  <td className="mono when stack-half">{d.day}</td>
                  <td className="stack-half">{d.name}</td>
                  <td className="mono stack-half" data-label={t("Hours on the schedule")}>
                    {d.shiftStarts
                      ? `${clockTime(d.shiftStarts, timezone)}–${clockTime(d.shiftEnds, timezone)}`
                      : "—"}
                  </td>
                  <td className="mono stack-half" data-label={t("Clocked")}>
                    {d.firstIn
                      ? `${clockTime(d.firstIn, timezone)}–${d.stillIn ? "…" : clockTime(d.lastOut, timezone)}`
                      : "—"}
                  </td>
                  <td className="right mono stack-half" data-label={t("Worked")}>
                    {d.minutes > 0 ? hours(d.minutes) : "—"}
                  </td>
                  <td className="badges">
                    {d.absent && (
                      <span className="badge err" data-testid="absent">
                        {t("Absent")}
                      </span>
                    )}
                    {d.lateMinutes !== null && (
                      <span className="badge warn" data-testid="late">
                        {t("Late by {time}", { time: hours(d.lateMinutes) })}
                      </span>
                    )}
                    {d.earlyMinutes !== null && (
                      <span className="badge warn" data-testid="early">
                        {t("Left {time} early", { time: hours(d.earlyMinutes) })}
                      </span>
                    )}
                    {d.overtimeMinutes > 0 && (
                      <span className="badge ok" data-testid="overtime">
                        {t("Overtime {time}", { time: hours(d.overtimeMinutes) })}
                      </span>
                    )}
                    {d.stillIn && <span className="badge ok">{t("Still in")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <b>{t("Each record of hours")}</b>
      {records.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("No hours were recorded these days.")}
        </p>
      ) : (
        <div className="tw">
          <table className="stack-table" data-testid="attendance-records">
            <thead>
              <tr>
                <th>{t("Who")}</th>
                <th>{t("In")}</th>
                <th>{t("Out")}</th>
                <th className="right">{t("Worked")}</th>
                <th>{t("How")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <RecordRow
                  key={r.id}
                  r={r}
                  at={at}
                  timezone={timezone}
                  canEdit={canEdit}
                  open={open?.id === r.id ? open.what : null}
                  setOpen={(what) => setOpen(what ? { what, id: r.id } : null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit &&
        (adding ? (
          <AddHours people={people} timezone={timezone} onDone={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            style={{ alignSelf: "start" }}
            onClick={() => setAdding(true)}
            data-testid="add-hours"
          >
            {t("+ Add hours nobody clocked…")}
          </button>
        ))}
    </div>
  );
}

function RecordRow({
  r,
  at,
  timezone,
  canEdit,
  open,
  setOpen,
}: {
  r: AttendanceRecord;
  at: (iso: string | null) => string;
  timezone: string;
  canEdit: boolean;
  open: "correct" | "cancel" | null;
  setOpen: (what: "correct" | "cancel" | null) => void;
}) {
  const { t } = useT();
  const hours = useHours();
  const cancelled = r.cancelledAt !== null;
  return (
    <>
      <tr
        data-testid="attendance-record"
        data-name={r.name}
        style={cancelled ? { opacity: 0.55 } : undefined}
      >
        <td>
          {r.name}
          {r.long && !r.clockOut && (
            <span className="badge err"> {t("Clocked in a long time")}</span>
          )}
        </td>
        <td className="mono stack-half" data-label={t("In")}>
          {at(r.clockIn)}
        </td>
        <td className="mono stack-half" data-label={t("Out")}>
          {r.clockOut ? at(r.clockOut) : <span className="badge ok">{t("Still in")}</span>}
        </td>
        <td className="right mono stack-half" data-label={t("Worked")}>
          {hours(r.minutes)}
        </td>
        <td className="stack-half" style={{ fontSize: ".85rem" }} data-label={t("How")}>
          {t(SOURCE_LABEL[r.source] ?? r.source)}
          {r.recordedBy && <span className="muted"> · {r.recordedBy}</span>}
          {r.editReason && (
            <div className="muted">
              {t("Corrected by {name}: {why}", { name: r.editedBy ?? "—", why: r.editReason })}
            </div>
          )}
          {cancelled && (
            <div className="badge err">
              {t("Cancelled by {name}: {why}", {
                name: r.cancelledBy ?? "—",
                why: r.cancelReason ?? "",
              })}
            </div>
          )}
          {r.settled && <div className="muted">{t("Its month's pay is approved")}</div>}
        </td>
        <td>
          {canEdit && !cancelled && !r.settled && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setOpen(open === "correct" ? null : "correct")}
                data-testid="correct-hours"
              >
                {t("Correct…")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(open === "cancel" ? null : "cancel")}
                data-testid="cancel-hours"
              >
                {t("Cancel…")}
              </button>
            </div>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            {open === "correct" ? (
              <CorrectHours r={r} timezone={timezone} onDone={() => setOpen(null)} />
            ) : (
              <CancelHours r={r} onDone={() => setOpen(null)} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CorrectHours({
  r,
  timezone,
  onDone,
}: {
  r: AttendanceRecord;
  timezone: string;
  onDone: () => void;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [inAt, setIn] = useState(isoToLocalTime(r.clockIn, timezone));
  const [outAt, setOut] = useState(r.clockOut ? isoToLocalTime(r.clockOut, timezone) : "");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    const clockIn = localTimeToIso(inAt, timezone);
    const clockOut = outAt ? localTimeToIso(outAt, timezone) : null;
    if (!clockIn || (outAt && !clockOut)) {
      setMsg({ ok: false, text: t("Enter a date and a time") });
      return;
    }
    start(async () => {
      const res = await op.run("correctAttendance", (key) =>
        correctAttendanceAction({ attendanceId: r.id, clockIn, clockOut, reason }, key),
      );
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}
      data-testid="correct-form"
    >
      <Field label={t("In")}>
        <input
          type="datetime-local"
          style={inputStyle}
          value={inAt}
          onChange={(e) => setIn(e.target.value)}
        />
      </Field>
      <Field label={t("Out (empty: still in)")}>
        <input
          type="datetime-local"
          style={inputStyle}
          value={outAt}
          onChange={(e) => setOut(e.target.value)}
        />
      </Field>
      <Field label={t("Why")} style={{ flex: 1, minWidth: 200 }}>
        <input
          style={inputStyle}
          value={reason}
          placeholder={t("e.g. forgot to clock out at closing")}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <button className="btn-primary" disabled={busy || !reason.trim()} onClick={save}>
        {busy ? t("Saving…") : t("Save the correction")}
      </button>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

function CancelHours({ r, onDone }: { r: AttendanceRecord; onDone: () => void }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await op.run("cancelAttendance", (key) =>
        cancelAttendanceAction({ attendanceId: r.id, reason }, key),
      );
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      data-testid="cancel-form"
    >
      <input
        aria-label={t("Why")}
        style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        value={reason}
        placeholder={t("e.g. clocked in the wrong person")}
        onChange={(e) => setReason(e.target.value)}
      />
      <button className="btn-primary" disabled={busy || !reason.trim()} onClick={save}>
        {busy ? t("Saving…") : t("Cancel this record")}
      </button>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

function AddHours({
  people,
  timezone,
  onDone,
}: {
  people: { id: string; name: string }[];
  timezone: string;
  onDone: () => void;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [who, setWho] = useState(people[0]?.id ?? "");
  const [inAt, setIn] = useState("");
  const [outAt, setOut] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function save() {
    setMsg(null);
    const clockIn = localTimeToIso(inAt, timezone);
    const clockOut = outAt ? localTimeToIso(outAt, timezone) : null;
    if (!clockIn || (outAt && !clockOut)) {
      setMsg({ ok: false, text: t("Enter a date and a time") });
      return;
    }
    start(async () => {
      const res = await op.run("addAttendance", (key) =>
        addAttendanceAction({ employeeId: who, clockIn, clockOut, reason }, key),
      );
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="card grid" style={{ gap: 8 }} data-testid="add-hours-form">
      <b>{t("Hours nobody clocked")}</b>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <Field label={t("Who")}>
          <select style={inputStyle} value={who} onChange={(e) => setWho(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("In")}>
          <input
            type="datetime-local"
            style={inputStyle}
            value={inAt}
            onChange={(e) => setIn(e.target.value)}
          />
        </Field>
        <Field label={t("Out (empty: still in)")}>
          <input
            type="datetime-local"
            style={inputStyle}
            value={outAt}
            onChange={(e) => setOut(e.target.value)}
          />
        </Field>
        <Field label={t("Why")} style={{ flex: 1, minWidth: 200 }}>
          <input
            style={inputStyle}
            value={reason}
            placeholder={t("e.g. the till was down")}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn-primary"
          disabled={busy || !who || !inAt || !reason.trim()}
          onClick={save}
        >
          {busy ? t("Saving…") : t("Add the hours")}
        </button>
        <button type="button" onClick={onDone} disabled={busy}>
          {t("Cancel")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
