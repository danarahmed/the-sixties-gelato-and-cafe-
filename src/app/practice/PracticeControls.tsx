"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPracticeAction, startPracticeAction } from "@/lib/actions/practice";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

/** Practice begun (or carried on), then straight to the next task; or begun again from the first day. */
export function PracticeControls({
  started,
  practising,
  next,
}: {
  started: boolean;
  practising: boolean;
  /** Where the next task is done. */
  next: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const go = (reset: boolean) =>
    start(async () => {
      setMsg(null);
      const r = reset ? await resetPracticeAction() : await startPracticeAction();
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      router.push(next ?? "/practice");
      router.refresh();
    });
  return (
    <div className="grid" style={{ gap: 8 }}>
      <Notice msg={msg} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {!practising && (
          <button
            type="button"
            className="btn-primary big"
            disabled={busy}
            onClick={() => go(false)}
            data-testid="practice-start"
          >
            {started ? t("Carry on practising") : t("Start practising")}
          </button>
        )}
        {started && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  t("Start again with a fresh practice café? What you ticked stays ticked."),
                )
              )
                go(true);
            }}
            data-testid="practice-reset"
          >
            {t("Start again from the first day")}
          </button>
        )}
      </div>
    </div>
  );
}
