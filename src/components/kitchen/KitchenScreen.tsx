"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { kitchenTicketsAction, setTicketStatusAction } from "@/lib/actions/kitchen";
import { useT } from "@/lib/i18n/I18nProvider";
import { waitedMinutes, type KitchenTicket } from "@/lib/kitchen";
import { fmtQty } from "@/lib/format";

const EVERY_MS = 8000;

/** A station's tickets (0110), asked again every few seconds; ready, then done, with a tap. */
export function KitchenScreen({
  stations,
  chosen,
}: {
  stations: { id: string; name: string }[];
  /** A station's id, "kitchen" for what no station takes, or "all". */
  chosen: string;
}) {
  const { t } = useT();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const station = chosen === "all" || chosen === "kitchen" ? null : chosen;

  const load = useCallback(async () => {
    const r = await kitchenTicketsAction(station, chosen === "all");
    if (r.ok) {
      setTickets(r.data);
      setError(null);
    } else setError(r.error);
    setNow(Date.now());
  }, [station, chosen]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), EVERY_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  async function mark(id: string, status: "new" | "ready" | "done") {
    setTickets((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    const r = await setTicketStatusAction(id, status);
    if (!r.ok) setError(r.error);
    void load();
  }

  const chips = [
    { id: "all", name: t("Every station") },
    ...stations.map((s) => ({ id: s.id, name: s.name })),
    ...(stations.length > 0 ? [{ id: "kitchen", name: t("No station") }] : []),
  ];

  return (
    <div className="grid" style={{ gap: 12 }} data-testid="kitchen-screen">
      {chips.length > 1 && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <Link
              key={c.id}
              href={`/kitchen?station=${c.id}`}
              className={c.id === chosen ? "chip active" : "chip"}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
      {error && (
        <p className="red" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      {tickets.length === 0 ? (
        <p className="muted" data-testid="kitchen-empty">
          {t("Nothing waiting for the kitchen.")}
        </p>
      ) : (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}
        >
          {tickets.map((k) => {
            const waited = waitedMinutes(k.at, now);
            return (
              <div
                key={k.id}
                className={`card kitchen-ticket ${k.status}`}
                data-testid="kitchen-ticket"
                data-status={k.status}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>
                    {k.title}
                    {k.turnNo ? ` · #${k.turnNo}` : ""}
                  </strong>
                  <span className={`mono ${waited >= 15 && k.status === "new" ? "red" : "muted"}`}>
                    {t("{n} min", { n: waited })}
                  </span>
                </div>
                {(k.course || (chosen === "all" && k.station)) && (
                  <div className="muted" style={{ fontSize: ".85rem" }}>
                    {[
                      k.course ? t("Course {n}", { n: k.course }) : null,
                      chosen === "all" ? k.station : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                <ul style={{ margin: "6px 0", paddingInlineStart: 18 }}>
                  {k.lines.map((l, i) => (
                    <li key={i} className={l.qty < 0 ? "red" : ""} data-testid="kitchen-line">
                      <strong className="mono">{fmtQty(l.qty)}×</strong> {l.name}
                      {l.qty < 0 && ` (${t("taken off")})`}
                      {l.addons && <div className="muted">+ {l.addons}</div>}
                      {l.note && (
                        <div>
                          <em>{l.note}</em>
                        </div>
                      )}
                      {l.seat && <div className="muted">{t("Seat {n}", { n: l.seat })}</div>}
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", gap: 8 }}>
                  {k.status === "new" && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => void mark(k.id, "ready")}
                      data-testid="ticket-ready"
                    >
                      {t("Ready")}
                    </button>
                  )}
                  {k.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => void mark(k.id, "done")}
                      data-testid="ticket-done"
                    >
                      {t("Done")}
                    </button>
                  )}
                  {k.status !== "new" && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => void mark(k.id, "new")}
                    >
                      {t("Back")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
