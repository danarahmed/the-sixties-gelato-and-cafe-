"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  paySocialInsuranceAction,
  setEmployeeSocialInsuranceAction,
  setSocialInsuranceAction,
} from "@/lib/actions/socialInsurance";
import { SI_PAID_FROM, type SiPaidFrom, type SocialInsurance } from "@/lib/socialInsurance";
import type { SocialInsuranceMonth } from "@/lib/socialInsurance";
import { fmtIQD } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;
const FROM_LABEL: Record<SiPaidFrom, string> = { bank: "The bank", safe: "The safe" };

/**
 * Social insurance (0112), on Payroll: on or off and its two parts (the
 * owner's to set), who is left out for a trial period, and each approved
 * month's owed, paid and left, paid to the government from the bank or the
 * safe.
 */
export function SocialInsuranceCard({
  si,
  months,
  people,
  canRun,
  isOwner,
}: {
  si: SocialInsurance;
  months: (SocialInsuranceMonth & { label: string })[];
  /** Everyone who works here now. */
  people: { id: string; name: string }[];
  canRun: boolean;
  isOwner: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [enabled, setEnabled] = useState(si.enabled);
  const [er, setEr] = useState(String(si.employerPercent));
  const [emp, setEmp] = useState(String(si.employeePercent));
  const [paying, setPaying] = useState<string | null>(null);
  const off = new Set(si.offFor.map((p) => p.id));
  const changed =
    enabled !== si.enabled ||
    Number(er) !== si.employerPercent ||
    Number(emp) !== si.employeePercent;

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setSocialInsuranceAction({
        enabled,
        employer: Number(er),
        employee: Number(emp),
      });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Saved: the next payroll approved takes it.") });
        router.refresh();
      }
    });
  }

  function person(id: string, on: boolean) {
    setMsg(null);
    start(async () => {
      const r = await setEmployeeSocialInsuranceAction({ employeeId: id, on });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else router.refresh();
    });
  }

  return (
    <div className="grid" style={{ gap: 12 }} data-testid="social-insurance">
      <Notice msg={msg} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label className="chip">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!isOwner || busy}
            onChange={(e) => setEnabled(e.target.checked)}
            data-testid="si-enabled"
          />{" "}
          {t("Social insurance is taken from the pay")}
        </label>
        <Field label={t("The café's part, %")}>
          <input
            style={{ ...inputStyle, width: 90 }}
            inputMode="decimal"
            value={er}
            disabled={!isOwner || busy}
            onChange={(e) => setEr(e.target.value)}
            data-testid="si-employer"
          />
        </Field>
        <Field label={t("The person's part, %")}>
          <input
            style={{ ...inputStyle, width: 90 }}
            inputMode="decimal"
            value={emp}
            disabled={!isOwner || busy}
            onChange={(e) => setEmp(e.target.value)}
            data-testid="si-employee"
          />
        </Field>
        {isOwner && changed && (
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>
            {busy ? t("Saving…") : t("Save")}
          </button>
        )}
      </div>
      {!isOwner && (
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
          {t("Only the owner turns social insurance on or off")}
        </p>
      )}
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {t(
          "Approving a payroll takes the person's part from their pay, and owes it with the café's part to the government: the café's part is Dr 6120 Social insurance, both are Cr 2110 Social insurance owed.",
        )}
      </p>

      {si.enabled && people.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 6px" }}>{t("Who it is taken for")}</h3>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {people.map((p) => (
              <label key={p.id} className="chip" data-testid="si-person" data-name={p.name}>
                <input
                  type="checkbox"
                  checked={!off.has(p.id)}
                  disabled={!canRun || busy}
                  onChange={(e) => person(p.id, e.target.checked)}
                />{" "}
                <span dir="auto">{p.name}</span>
              </label>
            ))}
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: ".8rem" }}>
            {t(
              "Untick someone on a trial period: nothing is taken for them until they are ticked.",
            )}
          </p>
        </div>
      )}

      {months.length > 0 && (
        <div className="tw">
          <table data-testid="si-months">
            <thead>
              <tr>
                <th>{t("Month")}</th>
                <th className="right">{t("The people's part")}</th>
                <th className="right">{t("The café's part")}</th>
                <th className="right">{t("Owed")}</th>
                <th className="right">{t("Paid")}</th>
                <th className="right">{t("Left")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <MonthRow
                  key={m.month}
                  m={m}
                  canRun={canRun}
                  open={paying === m.month}
                  setOpen={(o) => setPaying(o ? m.month : null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MonthRow({
  m,
  canRun,
  open,
  setOpen,
}: {
  m: SocialInsuranceMonth & { label: string };
  canRun: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useT();
  return (
    <>
      <tr data-testid="si-month" data-month={m.label}>
        <td>{m.label}</td>
        <td className="right money">{fmtIQD(m.employee)}</td>
        <td className="right money">{fmtIQD(m.employer)}</td>
        <td className="right money">{fmtIQD(m.owed)}</td>
        <td className="right money">{m.paid ? fmtIQD(m.paid) : "—"}</td>
        <td className="right money" data-testid="si-left">
          {fmtIQD(m.left)}
        </td>
        <td>
          {canRun && m.left > 0 && (
            <button type="button" onClick={() => setOpen(!open)} data-testid="si-pay">
              {t("Pay…")}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7}>
            <PayMonth m={m} onDone={() => setOpen(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function PayMonth({ m, onDone }: { m: SocialInsuranceMonth; onDone: () => void }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [amount, setAmount] = useState(String(m.left));
  const [from, setFrom] = useState<SiPaidFrom>("bank");
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function pay() {
    setMsg(null);
    start(async () => {
      const r = await op.run("paySocialInsurance", (key) =>
        paySocialInsuranceAction({ month: m.month, amount, paidFrom: from, reference: ref }, key),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}
      data-testid="si-pay-form"
    >
      <Field label={t("Amount")}>
        <input
          style={inputStyle}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label={t("Paid from")}>
        <select
          style={inputStyle}
          value={from}
          onChange={(e) => setFrom(e.target.value as SiPaidFrom)}
        >
          {SI_PAID_FROM.map((f) => (
            <option key={f} value={f}>
              {t(FROM_LABEL[f])}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("The government's receipt no.")}>
        <input style={inputStyle} value={ref} onChange={(e) => setRef(e.target.value)} />
      </Field>
      <button className="btn-primary" disabled={busy} onClick={pay}>
        {busy ? t("Saving…") : t("Pay the government")}
      </button>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}
