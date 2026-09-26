"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postLegacyUnpostedAction } from "@/lib/actions/books";
import { dateTimeIn } from "@/lib/dates";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import type { UnpostedRecord } from "@/lib/db/reports";

/** What kind of record it is, in words: phrases, shown through t(). */
const KIND_LABEL: Record<string, string> = {
  opening_stock: "Opening stock",
  goods_received: "Goods received",
  count_variance: "Count variance",
  waste: "Waste",
  stock_correction: "Stock correction",
};

/**
 * Stock the old app moved but never journaled. Each record is listed with the
 * journal the new app writes for the same record; the owner reviews them and
 * posts them in one step, with a reason on the audit trail. Nothing is posted
 * without that decision (docs/REMEDIATION.md).
 */
export function LegacyPostings({
  records,
  canPost,
  timezone,
}: {
  records: UnpostedRecord[];
  canPost: boolean;
  timezone: string;
}) {
  // say: a record's description as the database words it, in the reader's language.
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const total = records.reduce((s, r) => s + r.amount, 0);

  function post() {
    setMsg(null);
    start(async () => {
      const r = await postLegacyUnpostedAction({ reason });
      if (r.ok) {
        setMsg({
          ok: true,
          text: t("{n} journal(s) posted, {amount} in all. They are in the Journal Register.", {
            n: r.data.posted,
            amount: fmtIQD(r.data.total),
          }),
        });
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  if (records.length === 0) return msg ? <Notice msg={msg} /> : null;

  return (
    <div style={{ padding: "0 16px 14px" }}>
      <h4 style={{ margin: "4px 0 6px" }}>{t("Stock the old app never journaled")}</h4>
      <p className="muted" style={{ fontSize: ".78rem", marginTop: 0, lineHeight: 1.6 }}>
        {t(
          "These records moved stock before the upgrade but have no journal, so they show above as an Inventory difference. Each would post the entry the new app writes for the same record, dated when it happened. Post them only if the records are real.",
        )}
      </p>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("When")}</th>
              <th>{t("Record")}</th>
              <th>{t("Journal it would post")}</th>
              <th className="right">{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.kind + r.refId}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {dateTimeIn(timezone, r.at)}
                </td>
                <td>
                  <span className="ref auto">{t(KIND_LABEL[r.kind] ?? r.kind)}</span>{" "}
                  {say(r.description)}
                </td>
                <td className="mono" style={{ fontSize: ".78rem" }}>
                  {r.entry.replace(/\b(Dr|Cr)\b/g, (side) => t(side))}
                </td>
                <td className="right money">{fmtIQD(r.amount)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>
                <strong>{t("{n} record(s)", { n: records.length })}</strong>
              </td>
              <td className="right money">
                <strong>{fmtIQD(total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {canPost ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 10,
            alignItems: "center",
          }}
        >
          <input
            style={{ flex: "1 1 260px" }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("Why they are being posted (for the audit trail)")}
          />
          <button className="btn-primary" onClick={post} disabled={busy || reason.trim() === ""}>
            {busy ? t("Posting…") : t("Post these {n} journal(s)", { n: records.length })}
          </button>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: ".78rem" }}>
          {t("Only the owner can post them.")}
        </p>
      )}
      <div style={{ marginTop: 8 }}>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
