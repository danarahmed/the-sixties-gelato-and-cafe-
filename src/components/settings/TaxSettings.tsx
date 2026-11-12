"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaxSetupAction } from "@/lib/actions/tax";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { fmtIQD } from "@/lib/format";

interface Setup {
  enabled: boolean;
  kind: "vat" | "sales_tax";
  rate: number;
}
interface Report {
  collected: number;
  givenBack: number;
  paid: number;
  owed: number;
}

/**
 * Tax (0102): built in and off until the café is asked for it. The owner
 * turns it on with its kind and rate (prices include it), from then on only;
 * this month's tax collected, given back, paid and owed is shown under it.
 */
export function TaxSettings({
  setup,
  report,
  isOwner,
}: {
  setup: Setup;
  report: Report | null;
  isOwner: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [enabled, setEnabled] = useState(setup.enabled);
  const [kind, setKind] = useState(setup.kind);
  const [rate, setRate] = useState(setup.rate ? String(setup.rate) : "");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setTaxSetupAction({ enabled, kind, rate: Number(rate || 0), reason });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved.") });
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 10 }} data-testid="tax-settings">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Off until the café is asked for it. Turned on, the tax part of what each sale takes in (prices include it) is owed on 2600, not income; a refund gives it back. From then on only.",
        )}
      </p>
      <strong data-testid="tax-status">
        {setup.enabled
          ? `${t("Tax is on")} · ${t(setup.kind === "vat" ? "VAT" : "Sales tax")} · ${setup.rate}%`
          : t("Tax is off")}
      </strong>
      {isOwner && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}
        >
          <Field label={t("Tax")}>
            <select
              style={inputStyle}
              value={enabled ? "on" : "off"}
              onChange={(e) => setEnabled(e.target.value === "on")}
              data-testid="tax-enabled"
            >
              <option value="off">{t("Keep it off")}</option>
              <option value="on">{t("Turn tax on")}</option>
            </select>
          </Field>
          <Field label={t("Type")}>
            <select
              style={inputStyle}
              value={kind}
              onChange={(e) => setKind(e.target.value as Setup["kind"])}
            >
              <option value="vat">{t("VAT")}</option>
              <option value="sales_tax">{t("Sales tax")}</option>
            </select>
          </Field>
          <Field label={t("Rate (%)")}>
            <input
              style={inputStyle}
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              data-testid="tax-rate"
            />
          </Field>
          <Field label={t("Why")}>
            <input
              style={inputStyle}
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={save}
              disabled={busy}
              data-testid="tax-save"
            >
              {t("Save")}
            </button>
          </div>
        </div>
      )}
      <Notice msg={msg} />
      {report && (setup.enabled || report.owed !== 0) && (
        <table data-testid="tax-month">
          <tbody>
            <tr>
              <td>{t("Collected")}</td>
              <td className="right mono">{fmtIQD(report.collected)}</td>
            </tr>
            <tr>
              <td>{t("Given back")}</td>
              <td className="right mono">{fmtIQD(report.givenBack)}</td>
            </tr>
            <tr>
              <td>{t("Paid to the government")}</td>
              <td className="right mono">{fmtIQD(report.paid)}</td>
            </tr>
            <tr>
              <td>
                <strong>{t("Owed now")}</strong>
              </td>
              <td className="right mono">
                <strong>{fmtIQD(report.owed)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
