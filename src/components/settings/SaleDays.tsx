"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSaleDayAction, stopSaleDayAction } from "@/lib/actions/saleDays";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

interface SaleDay {
  id: string;
  name: string;
  percent: number;
  startsOn: string;
  endsOn: string;
  fromTime: string | null;
  toTime: string | null;
  excludedCategories: string[];
  excludedNames: string[];
  status: "planned" | "on" | "between" | "ended" | "stopped";
}

const STATUS_LABEL: Record<SaleDay["status"], string> = {
  planned: "To come",
  on: "On now",
  between: "On, outside its hours",
  ended: "Ended",
  stopped: "Stopped",
};

/**
 * Sale days (0106): "N% off, from this day to that day", hours optional, on
 * everything or with some categories left out. It ends by itself; one that
 * has begun is stopped, not changed. Each has its result under Reports.
 */
export function SaleDays({
  saleDays,
  categories,
  today,
}: {
  saleDays: SaleDay[];
  categories: { id: string; name: string }[];
  today: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [hours, setHours] = useState(false);
  const [fromTime, setFromTime] = useState("16:00");
  const [toTime, setToTime] = useState("22:00");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function reset() {
    setEditing(null);
    setName("");
    setPercent("");
    setFrom(today);
    setTo(today);
    setHours(false);
    setExcluded([]);
  }

  function edit(s: SaleDay) {
    setEditing(s.id);
    setName(s.name);
    setPercent(String(s.percent));
    setFrom(s.startsOn);
    setTo(s.endsOn);
    setHours(s.fromTime !== null);
    if (s.fromTime) setFromTime(s.fromTime);
    if (s.toTime) setToTime(s.toTime);
    setExcluded(s.excludedCategories);
    setMsg(null);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveSaleDayAction({
        id: editing,
        name,
        percent: Number(percent.replace(",", ".") || 0),
        startsOn: from,
        endsOn: to,
        fromTime: hours ? fromTime : null,
        toTime: hours ? toTime : null,
        excluded,
      });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        reset();
        router.refresh();
      }
    });
  }

  function stop(s: SaleDay) {
    setMsg(null);
    start(async () => {
      const r = await stopSaleDayAction(s.id);
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Sale day stopped") });
        router.refresh();
      }
    });
  }

  const when = (s: SaleDay) =>
    `${s.startsOn}${s.endsOn !== s.startsOn ? ` → ${s.endsOn}` : ""}${
      s.fromTime ? ` · ${s.fromTime}–${s.toTime}` : ""
    }`;

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="sale-days">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "A percentage off, from one day to another, at every till. It is never added to another discount: the bigger one wins. It ends by itself.",
        )}
      </p>
      {saleDays.length > 0 && (
        <table data-testid="sale-day-list">
          <thead>
            <tr>
              <th>{t("Name")}</th>
              <th>{t("Off (%)")}</th>
              <th>{t("When")}</th>
              <th>{t("Left out")}</th>
              <th>{t("Status")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {saleDays.map((s) => (
              <tr key={s.id} data-testid="sale-day-row" data-name={s.name}>
                <td>{s.name}</td>
                <td>{s.percent}%</td>
                <td dir="ltr">{when(s)}</td>
                <td>{s.excludedNames.length ? s.excludedNames.join(", ") : t("Nothing")}</td>
                <td>
                  <span className={s.status === "on" ? "badge ok" : "badge"}>
                    {t(STATUS_LABEL[s.status])}
                  </span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {s.status === "planned" && (
                    <button type="button" className="btn-link" onClick={() => edit(s)}>
                      {t("Change")}
                    </button>
                  )}
                  {(s.status === "planned" || s.status === "on" || s.status === "between") && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => stop(s)}
                      disabled={busy}
                      data-testid="sale-day-stop"
                    >
                      {t("Stop")}
                    </button>
                  )}
                  {s.status !== "planned" && (
                    <Link href={`/reports/sale-days?id=${s.id}`}>{t("Result")}</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h4 style={{ margin: "6px 0 0" }}>
        {editing ? t("Change the sale day") : t("A new sale day")}
      </h4>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}
      >
        <Field label={t("Name")}>
          <input
            style={inputStyle}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            data-testid="sale-day-name"
          />
        </Field>
        <Field label={t("Off (%)")}>
          <input
            style={inputStyle}
            inputMode="decimal"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            data-testid="sale-day-percent"
          />
        </Field>
        <Field label={t("From")}>
          <input
            type="date"
            style={inputStyle}
            value={from}
            min={today}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="sale-day-from"
          />
        </Field>
        <Field label={t("To")}>
          <input
            type="date"
            style={inputStyle}
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            data-testid="sale-day-to"
          />
        </Field>
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={hours} onChange={(e) => setHours(e.target.checked)} />
        {t("Only some hours of each day")}
      </label>
      {hours && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(2, minmax(120px, 200px))", gap: 8 }}
        >
          <Field label={t("From")}>
            <input
              type="time"
              style={inputStyle}
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
            />
          </Field>
          <Field label={t("To")}>
            <input
              type="time"
              style={inputStyle}
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
            />
          </Field>
        </div>
      )}
      {categories.length > 0 && (
        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
          <legend style={{ fontSize: ".85rem" }}>{t("Leave these categories out")}</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {categories.map((c) => (
              <label key={c.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={excluded.includes(c.id)}
                  onChange={(e) =>
                    setExcluded((x) =>
                      e.target.checked ? [...x, c.id] : x.filter((y) => y !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={busy}
          data-testid="sale-day-save"
        >
          {editing ? t("Save") : t("Start the sale day")}
        </button>
        {editing && (
          <button type="button" onClick={reset} disabled={busy}>
            {t("Cancel")}
          </button>
        )}
      </div>
      <Notice msg={msg} />
    </div>
  );
}
