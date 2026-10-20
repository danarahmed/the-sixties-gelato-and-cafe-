"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleProblemAction } from "@/lib/actions/problems";
import { reportText, type ProblemList } from "@/lib/problems";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";

export function ProblemsList({ list, timezone }: { list: ProblemList; timezone: string }) {
  const { t, msg } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  function settle(id: string, done: boolean) {
    setError(null);
    start(async () => {
      const r = await settleProblemAction({ reportId: id, done, note: notes[id] ?? null });
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  if (list.reports.length === 0)
    return (
      <p className="muted" data-testid="problems-none">
        {t("Nothing reported. Anyone can say something is wrong from the menu, on any screen.")}
      </p>
    );

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="problems">
      {error && (
        <p className="red" role="alert" style={{ margin: 0 }}>
          {msg(error)}
        </p>
      )}
      {list.reports.map((p) => (
        <section
          key={p.id}
          className={`card${p.status === "done" ? " faint" : ""}`}
          data-testid="problem-row"
          data-status={p.status}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <b dir="auto">{p.what}</b>
            <span className={`badge ${p.status === "done" ? "ok" : "warn"}`}>
              {p.status === "done" ? t("Dealt with") : t("Open")}
            </span>
          </div>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            <bdi className="mono">{dateTimeIn(timezone, p.createdAt)}</bdi>
            {p.by && (
              <>
                {" · "}
                <bdi>{p.by}</bdi>
              </>
            )}
            {p.place && (
              <>
                {" · "}
                <bdi>{p.place}</bdi>
              </>
            )}
            {" · "}
            <code dir="ltr">{p.page}</code>
          </div>
          {p.note && (
            <p style={{ margin: "6px 0 0" }} dir="auto">
              {t("Note: {note}", { note: p.note })}
            </p>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {p.status === "open" && (
              <input
                value={notes[p.id] ?? ""}
                maxLength={300}
                placeholder={t("What was done (optional)")}
                aria-label={t("What was done (optional)")}
                onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                style={{ flex: 1, minWidth: 180 }}
              />
            )}
            <button
              type="button"
              className={p.status === "open" ? "btn-primary" : undefined}
              disabled={busy}
              onClick={() => settle(p.id, p.status === "open")}
              data-testid="problem-settle"
            >
              {p.status === "open" ? t("Dealt with") : t("Open again")}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(reportText(p)).then(() => setCopied(p.id));
              }}
            >
              {copied === p.id ? t("Copied") : t("Copy to send on")}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
