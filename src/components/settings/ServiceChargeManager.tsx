"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setServiceChargeAction } from "@/lib/actions/tips";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice, inputStyle } from "@/components/ui";

/**
 * The service charge (0090), on Settings: a percentage for each of the café's
 * own ways of selling, or none. A delivery platform sets what its customers
 * pay, so it has none. The till adds it when a sale or a table's bill is
 * paid; the receipt and the bill show it.
 */
export function ServiceChargeManager({
  channels,
  charges,
}: {
  channels: { code: string; name: string }[];
  charges: Record<string, number>;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      channels.map((c) => [c.code, charges[c.code] ? String(charges[c.code]) : ""]),
    ),
  );

  function save(code: string, value: string) {
    setMsg(null);
    const v = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 50)) {
      setMsg({ ok: false, text: t("A service charge is between 0 and 50%") });
      return;
    }
    start(async () => {
      const r = await setServiceChargeAction({ channel: code, percent: v });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="service-charges">
      <Notice msg={msg} />
      <ul className="deal-list">
        {channels.map((c) => {
          const on = (charges[c.code] ?? 0) > 0;
          return (
            <li key={c.code} className="deal-row" data-testid="service-row" data-channel={c.code}>
              <div>
                <strong>{c.name}</strong>{" "}
                <span className={on ? "badge ok" : "muted"}>
                  {on ? `${charges[c.code]}%` : t("None")}
                </span>
              </div>
              <div className="row" style={{ gap: 6, alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, width: "7ch" }}
                  inputMode="decimal"
                  aria-label={t("Service charge on {way} (%)", { way: c.name })}
                  value={typed[c.code] ?? ""}
                  onChange={(e) => setTyped({ ...typed, [c.code]: e.target.value })}
                  placeholder="0"
                  disabled={busy}
                  data-testid="service-percent"
                />
                <span className="muted">%</span>
                <button
                  type="button"
                  onClick={() => save(c.code, typed[c.code] ?? "")}
                  disabled={busy}
                  data-testid="service-save"
                >
                  {t("Save")}
                </button>
                {on && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setTyped({ ...typed, [c.code]: "" });
                      save(c.code, "");
                    }}
                    disabled={busy}
                    data-testid="service-off"
                  >
                    {t("Turn off")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
