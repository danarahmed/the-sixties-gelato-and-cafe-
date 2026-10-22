"use client";

import { useState, useTransition } from "react";
import { setWatchVisibilityAction } from "@/lib/actions/watch";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

/** (The owner) Whether the general manager reads the watch list too (0094). */
export function WatchVisibility({ gmSees }: { gmSees: boolean }) {
  const { t } = useT();
  const [on, setOn] = useState(gmSees);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div data-testid="watch-visibility">
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: ".9rem" }}>
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.checked;
            setMsg(null);
            start(async () => {
              const r = await setWatchVisibilityAction({ gmSees: next });
              if (!r.ok) setMsg({ ok: false, text: r.error });
              else {
                setOn(r.data.gmSees);
                setMsg({ ok: true, text: t("Saved, and on the audit trail.") });
              }
            });
          }}
        />
        {t("The general manager reads the watch list too")}
      </label>
      <Notice msg={msg} />
    </div>
  );
}
