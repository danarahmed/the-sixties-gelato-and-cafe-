"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  allocateCreditAction,
  noteSupplierCreditAction,
  recordSupplierCreditAction,
} from "@/lib/actions/purchasing";
import { fmtIQD } from "@/lib/format";
import { CREDIT_KIND_LABEL, type SupplierCredit } from "@/lib/purchasing";
import { normaliseNumber } from "@/lib/validation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

export interface CreditBillOpt {
  id: string;
  invoiceNo: string;
  outstanding: number;
  /** A bill for a service: the account it was charged to. */
  accountCode: string | null;
}

/**
 * A supplier's credits (0044): what they owe back, for goods returned after
 * the bill, for a lower price on a delivery, or other; each set against their
 * bills, and what is left of it for a later bill. The supplier's own credit
 * note is recorded here, and matched to a return's credit when it comes.
 */
export function SupplierCredits({
  supplierId,
  credits,
  bills,
  deliveries,
  accounts,
  canCredit,
  canAllocate,
}: {
  supplierId: string;
  credits: SupplierCredit[];
  /** The supplier's bills still owed, to set a credit against. */
  bills: CreditBillOpt[];
  /** The supplier's deliveries that were billed: a lower price is credited against one. */
  deliveries: { id: string; receiptNo: number | null }[];
  /** Accounts a credit other than for goods may be taken off. */
  accounts: { code: string; name: string }[];
  canCredit: boolean;
  canAllocate: boolean;
}) {
  const { t } = useT();
  return (
    <div className="grid" style={{ gap: 14 }} data-testid="supplier-credits">
      <div className="card tw">
        <h3 style={{ marginTop: 0 }}>{t("Credit notes")}</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: ".85rem" }}>
          {t(
            "What this supplier owes back: goods returned after their bill, a lower price agreed on a delivery, or other. Each is set against their bills; what is left waits for the next one.",
          )}
        </p>
        {credits.length === 0 ? (
          <p className="muted" style={{ fontSize: ".9rem" }}>
            {t("No credits from this supplier.")}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("No.")}</th>
                <th>{t("Date")}</th>
                <th>{t("For")}</th>
                <th>{t("Their note")}</th>
                <th className="right">{t("Amount")}</th>
                <th className="right">{t("Left")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.id} data-testid="credit-row" data-credit={c.creditNo}>
                  <td className="mono">{c.creditNo}</td>
                  <td className="mono muted" style={{ fontSize: ".8rem" }}>
                    {c.creditDate}
                  </td>
                  <td style={{ fontSize: ".85rem" }}>
                    {t(CREDIT_KIND_LABEL[c.kind])}
                    {c.returnNo !== null && ` · ${t("return {no}", { no: c.returnNo })}`}
                    {c.receiptNo !== null && ` · ${t("delivery {no}", { no: c.receiptNo })}`}
                    <div className="muted">“{c.reason}”</div>
                  </td>
                  <td>{c.supplierRef ?? <NoteCredit creditId={c.id} canCredit={canCredit} />}</td>
                  <td className="right mono">{fmtIQD(c.amount)}</td>
                  <td className="right mono">{fmtIQD(c.left)}</td>
                  <td>
                    {canAllocate && c.left > 0 && bills.length > 0 && (
                      <Allocate credit={c} bills={bills} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {canCredit && (
        <RecordCredit
          supplierId={supplierId}
          bills={bills}
          deliveries={deliveries}
          accounts={accounts}
        />
      )}
    </div>
  );
}

/** The supplier's note for a return's credit: its number, matched. */
function NoteCredit({ creditId, canCredit }: { creditId: string; canCredit: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  if (!canCredit) {
    return <span className="badge warn">{t("Awaiting their note")}</span>;
  }
  return (
    <form
      style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (ref.trim() === "") return;
        setMsg(null);
        start(async () => {
          const r = await op.run("noteCredit", (key) =>
            noteSupplierCreditAction({ creditId, supplierRef: ref }, key),
          );
          if (!r.ok) {
            setMsg({ ok: false, text: r.error });
            return;
          }
          router.refresh();
        });
      }}
    >
      <input
        aria-label={t("The number on their credit note")}
        placeholder={t("Awaiting their note: its number")}
        style={{ width: 160 }}
        value={ref}
        onChange={(e) => setRef(e.target.value)}
      />
      <button type="submit" disabled={busy || ref.trim() === ""}>
        {t("Record it")}
      </button>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </form>
  );
}

/** What is left of a credit, set against one of the supplier's bills. */
function Allocate({ credit, bills }: { credit: SupplierCredit; bills: CreditBillOpt[] }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [billId, setBillId] = useState(bills[0]?.id ?? "");
  const bill = bills.find((b) => b.id === billId);
  const [amount, setAmount] = useState(
    String(Math.min(credit.left, bills[0]?.outstanding ?? credit.left)),
  );
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <form
      className="grid"
      style={{ gap: 6 }}
      data-testid="credit-allocate"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await op.run("allocateCredit", (key) =>
            allocateCreditAction(
              { creditId: credit.id, billId, amount: normaliseNumber(amount) },
              key,
            ),
          );
          if (!r.ok) {
            setMsg({ ok: false, text: r.error });
            return;
          }
          setMsg({
            ok: true,
            text: t("Set against the bill: {left} of the credit left.", {
              left: fmtIQD(r.data.creditLeft),
            }),
          });
          router.refresh();
        });
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select
          aria-label={t("Set it against")}
          value={billId}
          onChange={(e) => {
            setBillId(e.target.value);
            const b = bills.find((x) => x.id === e.target.value);
            if (b) setAmount(String(Math.min(credit.left, b.outstanding)));
          }}
        >
          {bills.map((b) => (
            <option key={b.id} value={b.id}>
              {t("Bill {no} ({owed} owed)", { no: b.invoiceNo, owed: fmtIQD(b.outstanding) })}
            </option>
          ))}
        </select>
        <input
          aria-label={t("Amount")}
          className="amt"
          inputMode="decimal"
          style={{ width: 100, textAlign: "end" }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="submit" disabled={busy || !bill || Number(normaliseNumber(amount)) <= 0}>
          {t("Set against it")}
        </button>
      </div>
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </form>
  );
}

/** The supplier's credit note: for a lower price on a delivery, or other. */
function RecordCredit({
  supplierId,
  bills,
  deliveries,
  accounts,
}: {
  supplierId: string;
  bills: CreditBillOpt[];
  deliveries: { id: string; receiptNo: number | null }[];
  accounts: { code: string; name: string }[];
}) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [kind, setKind] = useState<"price" | "other">(deliveries.length > 0 ? "price" : "other");
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [receiptId, setReceiptId] = useState(deliveries[0]?.id ?? "");
  const [billId, setBillId] = useState("");
  const bill = bills.find((b) => b.id === billId) ?? null;
  const [account, setAccount] = useState("");
  const ready =
    !busy &&
    ref.trim() !== "" &&
    reason.trim() !== "" &&
    Number(normaliseNumber(amount)) > 0 &&
    (kind === "price" ? receiptId !== "" : account !== "" || (bill?.accountCode ?? null) !== null);

  function submit() {
    if (!ready) return;
    setMsg(null);
    start(async () => {
      const r = await op.run("recordCredit", (key) =>
        recordSupplierCreditAction(
          {
            supplierId,
            kind,
            amount: normaliseNumber(amount),
            supplierRef: ref,
            reason,
            receiptId: kind === "price" ? receiptId : null,
            billId: kind === "other" && billId ? billId : null,
            accountCode: kind === "other" && account ? account : null,
          },
          key,
        ),
      );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setMsg({
        ok: true,
        text:
          r.data.setAgainstBill > 0
            ? t("Credit {no} recorded; {set} of it set against the bill.", {
                no: r.data.creditNo,
                set: fmtIQD(r.data.setAgainstBill),
              })
            : t("Credit {no} recorded: set it against a bill when one is owed.", {
                no: r.data.creditNo,
              }),
      });
      setRef("");
      setAmount("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form
      className="card grid"
      style={{ gap: 10 }}
      data-testid="record-credit"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h3 style={{ margin: 0 }}>{t("Record their credit note")}</h3>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="credit-kind"
            checked={kind === "price"}
            disabled={deliveries.length === 0}
            onChange={() => setKind("price")}
          />
          {t("A lower price on a delivery that was billed")}
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="credit-kind"
            checked={kind === "other"}
            onChange={() => setKind("other")}
          />
          {t("Other: a service, an overcharge")}
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label>
          <div className="sc">{t("The number on their credit note")}</div>
          <input
            aria-label={t("The number on their credit note")}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </label>
        <label>
          <div className="sc">{t("Amount (IQD)")}</div>
          <input
            aria-label={t("Amount (IQD)")}
            className="amt"
            inputMode="decimal"
            style={{ textAlign: "end" }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        {kind === "price" ? (
          <label>
            <div className="sc">{t("The delivery")}</div>
            <select
              aria-label={t("The delivery")}
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
            >
              {deliveries.map((d) => (
                <option key={d.id} value={d.id}>
                  {t("Delivery {no}", { no: d.receiptNo ?? "—" })}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              <div className="sc">{t("Against a bill")}</div>
              <select
                aria-label={t("Against a bill")}
                value={billId}
                onChange={(e) => setBillId(e.target.value)}
              >
                <option value="">{t("None: left on the account")}</option>
                {bills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {t("Bill {no} ({owed} owed)", { no: b.invoiceNo, owed: fmtIQD(b.outstanding) })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="sc">{t("Taken off the account")}</div>
              <select
                aria-label={t("Taken off the account")}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">
                  {bill?.accountCode
                    ? t("The bill's own ({code})", { code: bill.accountCode })
                    : t("Choose…")}
                </option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      <label>
        <div className="sc">{t("What it is for")}</div>
        <input
          aria-label={t("What it is for")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {kind === "price"
          ? t(
              "The stock of that delivery still on the shelf is revalued; what was used since goes to the price variance (5050). It is set against the delivery's bill.",
            )
          : t(
              "It comes off the account chosen, and is set against the bill chosen as far as it is owed.",
            )}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" type="submit" disabled={!ready}>
          {busy ? t("Saving…") : t("Record the credit")}
        </button>
        <OperationStatus op={op} />
        <Notice msg={msg} />
      </div>
    </form>
  );
}
