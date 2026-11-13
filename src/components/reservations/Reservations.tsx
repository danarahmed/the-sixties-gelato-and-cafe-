"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveReservationAction, setReservationStatusAction } from "@/lib/actions/reservations";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { addDays, dateTimeIn } from "@/lib/dates";

interface Booking {
  id: string;
  name: string;
  phone: string | null;
  party: number;
  at: string | null;
  status: "booked" | "seated" | "cancelled" | "no_show";
  note: string | null;
  tableId: string | null;
  table: string | null;
  waiting: boolean;
}

const STATUS: Record<Booking["status"], string> = {
  booked: "Booked",
  seated: "Seated",
  cancelled: "Cancelled",
  no_show: "Not come",
};

/** The day's bookings and the waiting list (0110): added, seated, cancelled or not come. */
export function Reservations({
  list,
  tables,
  day,
  today,
  timezone,
}: {
  list: Booking[];
  tables: { id: string; name: string; seats: number | null }[];
  day: string;
  today: string;
  timezone: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState("2");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [seatAt, setSeatAt] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (f: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setMsg(null);
    start(async () => {
      const r = await f();
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "" });
      else {
        after?.();
        router.refresh();
      }
    });
  };

  const add = (waiting: boolean) =>
    run(
      () =>
        saveReservationAction({
          id: null,
          name,
          phone: phone.trim() || null,
          party: Number(party) || 0,
          at: waiting || !when ? null : new Date(when).toISOString(),
          note: note.trim() || null,
          tableId: null,
        }),
      () => {
        setName("");
        setPhone("");
        setNote("");
        setWhen("");
      },
    );

  const waitingList = list.filter((b) => b.waiting);
  const bookings = list.filter((b) => !b.waiting);

  const row = (b: Booking) => (
    <tr key={b.id} data-testid="booking-row" data-name={b.name}>
      <td>{b.at ? dateTimeIn(timezone, b.at).slice(11) : t("Waiting")}</td>
      <td>
        <strong>{b.name}</strong>
        {b.phone && (
          <div className="muted mono" dir="ltr">
            {b.phone}
          </div>
        )}
        {b.note && (
          <div className="muted">
            <em>{b.note}</em>
          </div>
        )}
      </td>
      <td className="right mono">{b.party}</td>
      <td>
        <span className={b.status === "seated" ? "badge ok" : "badge"}>{t(STATUS[b.status])}</span>
        {b.table && <div className="muted">{b.table}</div>}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {b.status === "booked" && (
          <>
            <select
              style={inputStyle}
              aria-label={t("Table")}
              value={seatAt[b.id] ?? b.tableId ?? ""}
              onChange={(e) => setSeatAt((x) => ({ ...x, [b.id]: e.target.value }))}
            >
              <option value="">{t("Table")}</option>
              {tables.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.name}
                  {tb.seats ? ` (${tb.seats})` : ""}
                </option>
              ))}
            </select>{" "}
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              data-testid="booking-seat"
              onClick={() =>
                run(() =>
                  setReservationStatusAction({
                    id: b.id,
                    status: "seated",
                    tableId: (seatAt[b.id] ?? b.tableId) || null,
                  }),
                )
              }
            >
              {t("Seat them")}
            </button>{" "}
            <button
              type="button"
              className="btn-link"
              disabled={busy}
              onClick={() =>
                run(() =>
                  setReservationStatusAction({ id: b.id, status: "cancelled", tableId: null }),
                )
              }
            >
              {t("Cancelled")}
            </button>{" "}
            {!b.waiting && (
              <button
                type="button"
                className="btn-link"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    setReservationStatusAction({ id: b.id, status: "no_show", tableId: null }),
                  )
                }
              >
                {t("Not come")}
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );

  return (
    <div className="grid" style={{ gap: 12 }} data-testid="reservations">
      <div className="row" style={{ gap: 8 }}>
        <Link
          href={`/reservations?day=${addDays(day, -1)}`}
          className="chip"
          aria-label={t("The day before")}
        >
          ←
        </Link>
        <span className="chip active" dir="ltr">
          {day === today ? t("Today") : day}
        </span>
        <Link
          href={`/reservations?day=${addDays(day, 1)}`}
          className="chip"
          aria-label={t("The day after")}
        >
          →
        </Link>
      </div>
      <div className="card grid" style={{ gap: 8 }}>
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
              data-testid="booking-name"
            />
          </Field>
          <Field label={t("Phone")}>
            <input
              style={inputStyle}
              value={phone}
              inputMode="tel"
              maxLength={30}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label={t("How many")}>
            <input
              style={inputStyle}
              value={party}
              inputMode="numeric"
              onChange={(e) => setParty(e.target.value)}
              data-testid="booking-party"
            />
          </Field>
          <Field label={t("When")}>
            <input
              type="datetime-local"
              style={inputStyle}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              data-testid="booking-when"
            />
          </Field>
          <Field label={t("Note")}>
            <input
              style={inputStyle}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !when}
            onClick={() => add(false)}
            data-testid="booking-add"
          >
            {t("Book a table")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => add(true)}
            data-testid="booking-wait"
          >
            {t("Waiting now")}
          </button>
        </div>
        <Notice msg={msg} />
      </div>
      {waitingList.length > 0 && (
        <div className="card tw">
          <h3 style={{ marginTop: 0 }}>{t("Waiting now")}</h3>
          <table data-testid="waiting-list">
            <tbody>{waitingList.map(row)}</tbody>
          </table>
        </div>
      )}
      <div className="card tw">
        <h3 style={{ marginTop: 0 }}>{t("Bookings")}</h3>
        {bookings.length === 0 ? (
          <p className="muted">{t("No bookings this day.")}</p>
        ) : (
          <table data-testid="booking-list">
            <tbody>{bookings.map(row)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
