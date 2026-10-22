"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleWatchFindingAction } from "@/lib/actions/watch";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

/** A finding marked explained or looked into, with a note (0094). */
export function SettleFinding({ findingId }: { findingId: string }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function settle(status: "explained" | "looked_into") {
    setMsg(null);
    start(async () => {
      const r = await op.run("settleWatch", (key) =>
        settleWatchFindingAction({ findingId, status, note }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 6 }} data-testid="watch-settle">
      <label>
        <span className="sc">{t("A note (on the audit trail)")}</span>
        <input
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("e.g. the regulars' discount, agreed")}
        />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={busy} onClick={() => settle("explained")}>
          {t("Explained")}
        </button>
        <button type="button" disabled={busy} onClick={() => settle("looked_into")}>
          {t("Looked into")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
