"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { detachDocumentAction } from "@/lib/actions/documents";

/**
 * A document taken off its record, saying why. It is not deleted: the page
 * keeps it among those taken off, and the audit trail says who and why.
 */
export function DetachDocument({ documentId, fileName }: { documentId: string; fileName: string }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function detach() {
    setBusy(true);
    setNotice(null);
    try {
      const r = await op.run("detach", (key) => detachDocumentAction({ documentId, reason }, key));
      if (!r.ok) {
        setNotice({ ok: false, text: r.error });
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        className="linklike"
        onClick={() => setOpen(true)}
        data-testid="document-detach"
      >
        {t("Take off")}
      </button>
    );
  return (
    <div className="grid" style={{ gap: 6, minWidth: 220 }} data-testid="document-detach-form">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("Why is {name} taken off?", { name: fileName })}
        aria-label={t("Why is {name} taken off?", { name: fileName })}
        maxLength={500}
        style={inputStyle}
        data-testid="document-detach-reason"
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={detach}
          disabled={busy || !reason.trim()}
          data-testid="document-detach-confirm"
        >
          {t("Take it off")}
        </button>
        <button type="button" className="linklike" onClick={() => setOpen(false)} disabled={busy}>
          {t("Cancel")}
        </button>
        <OperationStatus op={op} />
      </div>
      <Notice msg={notice} />
    </div>
  );
}
