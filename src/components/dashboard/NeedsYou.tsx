"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeAlertAction, snoozeAlertAction } from "@/lib/actions/alerts";
import {
  CONFIDENCE_LABEL,
  canAnswer,
  groupByRule,
  ruleLabel,
  snoozeRange,
  sortAlerts,
  type Alert,
} from "@/lib/alerts";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;

/**
 * What needs the owner, at the top of the dashboard (0029, the audit's P1-8):
 * 🔴 and 🟠 waiting for someone, 🟢 when nothing does, and 🔵 what has been
 * answered or snoozed — still open until its condition clears. Orange alerts
 * of one rule fold into one row to open; red ones are always shown.
 */
export function NeedsYou({
  alerts,
  canAct,
  myId,
  today,
  timezone,
}: {
  alerts: Alert[];
  /** May answer and snooze: the owner and managers (sale.void or accounting.post). */
  canAct: boolean;
  myId: string;
  today: string;
  timezone: string;
}) {
  const { t } = useT();
  const { needsYou, answered } = sortAlerts(alerts);
  const row = (a: Alert) => (
    <AlertRow
      key={a.id}
      a={a}
      canAct={canAct && canAnswer(a, myId)}
      today={today}
      timezone={timezone}
    />
  );
  return (
    <section className="grid" style={{ gap: 10 }} data-testid="needs-you">
      <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{t("dash.needsYou")}</h2>
      {needsYou.length === 0 ? (
        <div className="alert-row green" data-testid="all-clear">
          <span className="alert-title">🟢 {t("dash.allClear")}</span>
          <span className="alert-why">
            {answered.length
              ? `${answered.length} answered or snoozed, below: each stays until it clears.`
              : "Every rule has been checked against the books just now."}
          </span>
        </div>
      ) : (
        <div className="alerts">
          {needsYou.filter((a) => a.urgency === "red").map(row)}
          {groupByRule(needsYou.filter((a) => a.urgency === "orange")).map((g) =>
            g.alerts.length === 1 ? (
              row(g.alerts[0]!)
            ) : (
              <details
                key={g.rule}
                className="alert-row orange alert-group"
                data-testid="alert-group"
                data-rule={g.rule}
              >
                <summary>
                  <span className="alert-title">
                    🟠 {ruleLabel(g.rule)}: {g.alerts.length}
                  </span>{" "}
                  <span className="alert-why">— {g.alerts[0]!.why}</span>
                </summary>
                <div className="alerts" style={{ marginTop: 8 }}>
                  {g.alerts.map(row)}
                </div>
              </details>
            ),
          )}
        </div>
      )}
      {answered.length > 0 && (
        <details data-testid="answered">
          <summary style={{ cursor: "pointer" }}>
            🔵 {t("dash.answered")} ({answered.length})
          </summary>
          <div className="alerts" style={{ marginTop: 8 }}>
            {answered.map(row)}
          </div>
        </details>
      )}
    </section>
  );
}

function AlertRow({
  a,
  canAct,
  today,
  timezone,
}: {
  a: Alert;
  canAct: boolean;
  today: string;
  timezone: string;
}) {
  const router = useRouter();
  const range = snoozeRange(today);
  const [mode, setMode] = useState<"none" | "answer" | "snooze">("none");
  const [note, setNote] = useState("");
  const [until, setUntil] = useState(range.suggested);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const answered = Boolean(a.acknowledgedAt || a.snoozedUntil);
  const icon = answered ? "🔵" : a.urgency === "red" ? "🔴" : "🟠";

  function send() {
    setMsg(null);
    start(async () => {
      const r =
        mode === "answer"
          ? await acknowledgeAlertAction({ alertId: a.id, note })
          : await snoozeAlertAction({ alertId: a.id, until, reason: note });
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMode("none");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div
      className={`alert-row ${answered ? "blue" : a.urgency}`}
      data-testid="alert"
      data-rule={a.rule}
      data-urgency={answered ? "answered" : a.urgency}
    >
      <span className="alert-title">
        {icon} {a.title}
      </span>
      {a.why && <span className="alert-why">{a.why}</span>}
      <div className="alert-meta">
        {a.action &&
          (a.link ? (
            <Link href={a.link}>{a.action} →</Link>
          ) : (
            <span style={{ color: "var(--text)" }}>{a.action}</span>
          ))}
        <span className="badge">{ruleLabel(a.rule)}</span>
        <span
          className={`badge ${a.confidence === "high" ? "ok" : a.confidence === "medium" ? "warn" : ""}`}
          title="How sure the rule is"
        >
          {CONFIDENCE_LABEL[a.confidence]}
        </span>
        <span>since {dateTimeIn(timezone, a.firstSeenAt)}</span>
      </div>
      {a.acknowledgedAt && (
        <span className="alert-why">
          Answered by {a.acknowledgedBy ?? "someone"} ({dateTimeIn(timezone, a.acknowledgedAt)}): “
          {a.ackNote}”
        </span>
      )}
      {a.snoozedUntil && (
        <span className="alert-why">
          Snoozed until {dateTimeIn(timezone, a.snoozedUntil).slice(0, 10)} by{" "}
          {a.snoozedBy ?? "someone"}: “{a.snoozeReason}”
        </span>
      )}
      {canAct && mode === "none" && (
        <div className="alert-answer">
          <button type="button" onClick={() => setMode("answer")}>
            {a.acknowledgedAt ? "Answer again" : "Answer"}
          </button>
          {!a.snoozedUntil && (
            <button type="button" onClick={() => setMode("snooze")}>
              Snooze
            </button>
          )}
        </div>
      )}
      {canAct && mode !== "none" && (
        <form
          className="alert-answer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {mode === "snooze" && (
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              until
              <input
                type="date"
                aria-label="Snooze until"
                min={range.min}
                max={range.max}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                required
              />
            </label>
          )}
          <input
            aria-label={mode === "answer" ? "What was done, or why it is fine" : "Why it can wait"}
            placeholder={mode === "answer" ? "What was done, or why it is fine" : "Why it can wait"}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            autoFocus
          />
          <button className="btn-primary" disabled={busy || note.trim().length < 3}>
            {busy ? "Saving…" : mode === "answer" ? "Save the answer" : "Snooze it"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("none");
              setMsg(null);
            }}
          >
            Cancel
          </button>
        </form>
      )}
      <Notice msg={msg} />
    </div>
  );
}
