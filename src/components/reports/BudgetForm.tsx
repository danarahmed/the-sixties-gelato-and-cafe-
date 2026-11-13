"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBudgetAction } from "@/lib/actions/budget";
import { fmtIQD } from "@/lib/format";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";

/**
 * A month's budget (0117), for the owner or the accountant: what the café
 * plans to take in and to spend on each account, started from what was set,
 * or from last month's figures with one press.
 */
export function BudgetForm({
  month,
  accounts,
  set,
  lastMonth,
}: {
  /** The month's first day. */
  month: string;
  accounts: { code: string; name: string; section: string }[];
  /** What the month's budget is now: {code: amount}. */
  set: Record<string, number>;
  /** Last month's figures, to start from. */
  lastMonth: Record<string, number>;
}) {
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((a) => [a.code, set[a.code] ? String(set[a.code]) : ""])),
  );

  function save() {
    setMsg(null);
    const lines: Record<string, number> = {};
    for (const a of accounts) lines[a.code] = Number(normaliseNumber(values[a.code] ?? "")) || 0;
    start(async () => {
      const r = await setBudgetAction({ month, lines });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({
          ok: true,
          text: t("Saved: the budget of {month}.", { month: month.slice(0, 7) }),
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 8 }} data-testid="budget-form">
      <Notice msg={msg} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() =>
            setValues(
              Object.fromEntries(
                accounts.map((a) => [
                  a.code,
                  lastMonth[a.code] ? String(Math.round(lastMonth[a.code] ?? 0)) : "",
                ]),
              ),
            )
          }
          disabled={busy}
          data-testid="budget-from-last"
        >
          {t("Start from last month's figures")}
        </button>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Account")}</th>
              <th className="right">{t("Last month")}</th>
              <th className="right">{t("Budget")}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.code} data-testid="budget-row" data-code={a.code}>
                <td>
                  <span className="mono muted">{a.code}</span> {say(a.name)}
                </td>
                <td className="right money muted">
                  {lastMonth[a.code] ? fmtIQD(lastMonth[a.code] ?? 0) : "—"}
                </td>
                <td className="right">
                  <input
                    inputMode="decimal"
                    className="amt"
                    style={{ width: 130, textAlign: "end" }}
                    aria-label={t("Budget for {account}", { account: `${a.code} ${say(a.name)}` })}
                    value={values[a.code] ?? ""}
                    onChange={(e) => setValues({ ...values, [a.code]: e.target.value })}
                    disabled={busy}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn-primary"
        onClick={save}
        disabled={busy}
        style={{ width: "fit-content" }}
      >
        {busy ? t("Saving…") : t("Save the budget")}
      </button>
    </div>
  );
}
