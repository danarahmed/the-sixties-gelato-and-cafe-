"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setItemUseByAction } from "@/lib/actions/useBy";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { normaliseNumber } from "@/lib/validation";
import { EXPIRY_MODES, type ExpiryMode } from "@/lib/useBy";

/**
 * How an item keeps (0098), chosen once on its page: it doesn't go off, it
 * keeps some days from delivery, or each delivery has the date on its pack.
 * Every delivery of it then takes its use-by from this.
 */
export function ItemKeeping({
  itemId,
  mode,
  keepsDays,
  canEdit,
  madeHere,
}: {
  itemId: string;
  mode: ExpiryMode | null;
  keepsDays: number | null;
  canEdit: boolean;
  /** Made here in batches: its use-by comes from its recipe. */
  madeHere: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [choice, setChoice] = useState<ExpiryMode | null>(mode);
  const [days, setDays] = useState(keepsDays === null ? "" : String(keepsDays));
  const typed = days.trim() === "" ? null : Number(normaliseNumber(days));
  const daysOk = typed !== null && Number.isInteger(typed) && typed >= 1 && typed <= 365;
  const changed = choice !== mode || (choice === "keeps_days" && typed !== keepsDays);

  function save() {
    if (!choice) return;
    if (choice === "keeps_days" && !daysOk) {
      setMsg({ ok: false, text: t("Say how many days it keeps from delivery: 1 to 365") });
      return;
    }
    setMsg(null);
    start(async () => {
      const r = await op.run(`useBy:${itemId}`, (key) =>
        setItemUseByAction(
          { itemId, mode: choice, days: choice === "keeps_days" ? typed : null },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({ ok: true, text: t("Saved.") });
      router.refresh();
    });
  }

  return (
    <section className="panel" data-testid="item-keeping" id="keeping">
      <h2 style={{ marginTop: 0 }}>{t("How it keeps")}</h2>
      {madeHere && (
        <p className="muted" style={{ marginTop: 0 }}>
          {t("Made here in batches: each batch's use-by comes from its recipe.")}
        </p>
      )}
      {mode === null && (
        <p className="badge warn" style={{ display: "inline-block" }}>
          {t("Not chosen yet: choose how it keeps, so its deliveries carry a use-by.")}
        </p>
      )}
      <div className="grid" style={{ gap: 8 }}>
        {EXPIRY_MODES.map((m) => (
          <label key={m.mode} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
            <input
              type="radio"
              name={`keeps-${itemId}`}
              checked={choice === m.mode}
              onChange={() => setChoice(m.mode)}
              disabled={!canEdit || busy}
              data-testid={`keeping-${m.mode}`}
            />
            <span>
              <strong>{t(m.label)}</strong>
              <br />
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {t(m.hint)}
              </span>
              {m.mode === "keeps_days" && choice === "keeps_days" && (
                <span className="row" style={{ gap: 6, marginTop: 4 }}>
                  <input
                    style={{ ...inputStyle, width: "7ch" }}
                    inputMode="numeric"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    disabled={!canEdit || busy}
                    aria-label={t("Days it keeps once it comes")}
                    data-testid="keeping-days"
                  />
                  <span>{t("days")}</span>
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {canEdit && (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={busy || !choice || !changed}
            data-testid="keeping-save"
          >
            {busy ? t("Saving…") : t("Save")}
          </button>
          <OperationStatus op={op} />
        </div>
      )}
      <Notice msg={msg} />
    </section>
  );
}
