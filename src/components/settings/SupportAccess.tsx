"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantSupportAction, revokeSupportAction } from "@/lib/actions/support";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { dateTimeIn } from "@/lib/dates";

/**
 * Support access (0109): the system's support sees the business only while
 * the owner allows it, for 1 to 72 hours, read-only; each visit is listed
 * here and on the audit trail. Taken back at any time. And the business's
 * data, exported at any time.
 */
export function SupportAccess({
  openUntil,
  grants,
  visits,
  timezone,
}: {
  timezone: string;
  openUntil: string | null;
  grants: {
    grantedAt: string;
    until: string;
    reason: string;
    revokedAt: string | null;
    by: string;
  }[];
  visits: string[];
}) {
  const { t } = useT();
  const router = useRouter();
  const fmtDateTime = (iso: string) => dateTimeIn(timezone, iso);
  const [busy, start] = useTransition();
  const [hours, setHours] = useState("4");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => {
    setMsg(null);
    start(async () => {
      const r = await f();
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "" });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="support-access">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "The system's support sees this business only while you allow it, and changes nothing. Each visit is listed here and on the audit trail.",
        )}
      </p>
      <strong data-testid="support-now">
        {openUntil
          ? t("Support may look until {at}", { at: fmtDateTime(openUntil) })
          : t("Support has no access")}
      </strong>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}
      >
        <Field label={t("For how many hours")}>
          <select
            style={inputStyle}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            data-testid="support-hours"
          >
            {[1, 4, 24, 72].map((h) => (
              <option key={h} value={String(h)}>
                {h}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Why")}>
          <input
            style={inputStyle}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            data-testid="support-reason"
          />
        </Field>
        <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => run(() => grantSupportAction({ hours: Number(hours), reason }))}
            data-testid="support-grant"
          >
            {t("Allow support")}
          </button>
          {openUntil && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => revokeSupportAction())}
              data-testid="support-revoke"
            >
              {t("Take it back")}
            </button>
          )}
        </div>
      </div>
      {visits.length > 0 && (
        <p style={{ margin: 0, fontSize: ".9rem" }} data-testid="support-visits">
          {t("Support looked at:")} {visits.map((v) => fmtDateTime(v)).join(" · ")}
        </p>
      )}
      {grants.length > 0 && (
        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: ".85rem" }} className="muted">
          {grants.map((g) => (
            <li key={g.grantedAt}>
              {fmtDateTime(g.grantedAt)} → {fmtDateTime(g.revokedAt ?? g.until)} · {g.by} ·{" "}
              {g.reason}
            </li>
          ))}
        </ul>
      )}
      <Notice msg={msg} />
      <p style={{ margin: "6px 0 0" }}>
        <a href="/settings/export" data-testid="export-data">
          {t("Download all of the business's data")}
        </a>
      </p>
    </div>
  );
}
