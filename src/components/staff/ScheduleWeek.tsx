"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveScheduleAction } from "@/lib/actions/staff";
import { addDays } from "@/lib/dates";
import { clockTime, typedHours, worksOn, type Schedule, type Shift } from "@/lib/staff";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

/** The days of the week, Saturday first: phrases, shown through t(). */
/** The café's week, Saturday first: phrases, shown through t(). */
const DAY_NAME = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const cellKey = (employeeId: string, day: string) => `${employeeId}|${day}`;
const hoursOf = (s: Shift, timezone: string) =>
  `${clockTime(s.startsAt, timezone)}-${clockTime(s.endsAt, timezone)}`;

/**
 * A branch's week (0049): who works when, one stretch of hours a person a
 * day, typed as 08:00-16:00 (ending at or before it starts: the next day).
 * Saved a week at a time; a day whose pay is approved keeps its hours.
 */
export function ScheduleWeek({
  schedule,
  lastWeek,
  days,
  locationId,
  places,
  timezone,
  canManage,
  prevHref,
  nextHref,
}: {
  schedule: Schedule;
  /** The week before, to start from the same hours. */
  lastWeek: Schedule;
  days: string[];
  locationId: string;
  places: { id: string; name: string }[];
  timezone: string;
  canManage: boolean;
  prevHref: string;
  nextHref: string;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const here = schedule.shifts.filter((s) => s.locationId === locationId);
  const elsewhere = schedule.shifts.filter((s) => s.locationId !== locationId);
  // The page gives each week and branch its own grid (key), so this is read once for it.
  const initial: Record<string, string> = Object.fromEntries(
    here.map((s) => [cellKey(s.employeeId, s.day), hoursOf(s, timezone)]),
  );
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const people = schedule.people.filter(
    (p) => p.locationId === locationId || here.some((s) => s.employeeId === p.id),
  );
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? "";
  const settledDay = new Set(schedule.shifts.filter((s) => s.settled).map((s) => s.day));
  const changed = Object.keys({ ...initial, ...cells }).some(
    (k) => (initial[k] ?? "") !== (cells[k] ?? ""),
  );

  function sameAsLastWeek() {
    const next: Record<string, string> = { ...cells };
    for (const s of lastWeek.shifts.filter((x) => x.locationId === locationId)) {
      const day = addDays(s.day, 7);
      const p = schedule.people.find((x) => x.id === s.employeeId);
      if (days.includes(day) && p && worksOn(p, day) && !settledDay.has(day))
        next[cellKey(s.employeeId, day)] = hoursOf(s, timezone);
    }
    setCells(next);
  }

  function save() {
    setMsg(null);
    const shifts: { employeeId: string; day: string; starts: string; ends: string }[] = [];
    for (const [k, v] of Object.entries(cells)) {
      if (!v.trim()) continue;
      const [employeeId = "", day = ""] = k.split("|");
      const h = typedHours(v);
      if (!h) {
        const who = schedule.people.find((p) => p.id === employeeId)?.name ?? "";
        setMsg({
          ok: false,
          text: t("Give {name}'s hours on {day} as 08:00-16:00", { name: who, day }),
        });
        return;
      }
      shifts.push({ employeeId, day, ...h });
    }
    start(async () => {
      const r = await op.run("saveSchedule", (key) =>
        saveScheduleAction({ locationId, from: first, to: last, shifts }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("The week's hours are saved.") });
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Link href={prevHref} data-testid="week-before">
          ← {t("The week before")}
        </Link>
        <b className="mono">
          {first} — {last}
        </b>
        <Link href={nextHref} data-testid="week-after">
          {t("The week after")} →
        </Link>
        {places.length > 1 && (
          <span style={{ display: "flex", gap: 6, marginInlineStart: "auto" }}>
            {places.map((l) => (
              <Link
                key={l.id}
                href={`?week=${first}&place=${l.id}#schedule`}
                className={l.id === locationId ? "badge ok" : "badge"}
              >
                {l.name}
              </Link>
            ))}
          </span>
        )}
      </div>
      {people.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("Nobody works here this week.")}
        </p>
      ) : (
        <div className="tw">
          <table data-testid="schedule">
            <thead>
              <tr>
                <th>{t("Who")}</th>
                {days.map((d, i) => (
                  <th key={d} style={{ minWidth: 118 }}>
                    {t(DAY_NAME[i] ?? "")} <span className="muted mono">{d.slice(5)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} data-testid="schedule-row" data-name={p.name}>
                  <td>
                    <b>{p.name}</b>
                    {p.title && (
                      <div className="muted" style={{ fontSize: ".8rem" }}>
                        {p.title}
                      </div>
                    )}
                  </td>
                  {days.map((d) => {
                    const away = elsewhere.find((s) => s.employeeId === p.id && s.day === d);
                    const k = cellKey(p.id, d);
                    const settled = settledDay.has(d);
                    return (
                      <td key={d}>
                        {away ? (
                          <span className="muted" style={{ fontSize: ".8rem" }}>
                            {away.location}: {hoursOf(away, timezone)}
                          </span>
                        ) : !worksOn(p, d) ? (
                          <span className="muted">—</span>
                        ) : canManage && !settled ? (
                          <input
                            aria-label={t("{name}'s hours on {day}", { name: p.name, day: d })}
                            data-testid="schedule-cell"
                            data-day={d}
                            style={{
                              ...inputStyle,
                              minHeight: 36,
                              padding: "0 6px",
                              fontSize: ".85rem",
                            }}
                            dir="ltr"
                            placeholder="08:00-16:00"
                            value={cells[k] ?? ""}
                            onChange={(e) => setCells((c) => ({ ...c, [k]: e.target.value }))}
                          />
                        ) : (
                          <span className="mono" style={{ fontSize: ".85rem" }}>
                            {cells[k] || "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canManage && people.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="btn-primary"
            disabled={busy || !changed}
            onClick={save}
            data-testid="save-schedule"
          >
            {busy ? t("Saving…") : t("Save the week")}
          </button>
          {lastWeek.shifts.some((s) => s.locationId === locationId) && (
            <button
              type="button"
              onClick={sameAsLastWeek}
              disabled={busy}
              data-testid="same-as-last-week"
            >
              {t("The same hours as the week before")}
            </button>
          )}
          <span className="muted" style={{ fontSize: ".8rem" }}>
            {t(
              "Type the hours as 08:00-16:00; hours ending at or before they start end the next day. Empty: not working.",
            )}
          </span>
        </div>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
