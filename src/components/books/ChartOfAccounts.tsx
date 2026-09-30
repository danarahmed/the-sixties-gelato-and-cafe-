"use client";
/**
 * The chart of accounts (0058, the August audit's M-06): every account by its
 * kind, and for the owner, a general manager or the accountant, an income or
 * a cost added, one the café added renamed, taken out of use or brought back.
 * Its names in Arabic and Kurdish are kept as the café's own words for its
 * name, so every screen shows it in the reader's language. The accounts the
 * system posts to are kept as they are.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAccountAction,
  renameAccountAction,
  setAccountInUseAction,
} from "@/lib/actions/books";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { nextFreeCode } from "@/lib/chart";

export interface ChartAccount {
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  isSystem: boolean;
}

type Msg = { ok: boolean; text: string } | null;

/** The kinds, in the order of the books, each in words: phrases, shown through t(). */
const KINDS: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Income",
  expense: "Expense",
};

export function ChartOfAccounts({
  accounts,
  canChange,
}: {
  accounts: ChartAccount[];
  canChange: boolean;
}) {
  const { t } = useT();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <section className="panel" data-testid="chart">
      <div className="panel-h">
        <h3>{t("The accounts")}</h3>
        <span className="muted" style={{ fontSize: ".74rem" }}>
          {t(
            "An income or a cost the café adds is changed here; the accounts the system posts to stay as they are.",
          )}
        </span>
      </div>
      <div className="panel-b grid" style={{ gap: 12 }}>
        <Notice msg={msg} />
        <div className="tw">
          <table className="stack-table" data-testid="chart-table">
            <thead>
              <tr>
                <th>{t("Code")}</th>
                <th>{t("Account")}</th>
                <th>{t("Type")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Object.entries(KINDS).flatMap(([type, label]) =>
                accounts
                  .filter((a) => a.type === type)
                  .map((a) => (
                    <AccountRow
                      key={a.code}
                      account={a}
                      kind={t(label)}
                      canChange={canChange}
                      onDone={setMsg}
                    />
                  )),
              )}
            </tbody>
          </table>
        </div>
        {canChange && <AddAccount accounts={accounts} onDone={setMsg} />}
      </div>
    </section>
  );
}

function AccountRow({
  account: a,
  kind,
  canChange,
  onDone,
}: {
  account: ChartAccount;
  kind: string;
  canChange: boolean;
  onDone: (m: Msg) => void;
}) {
  const op = useOperation();
  const { t, msg: say } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState<"rename" | "use" | null>(null);
  const [name, setName] = useState(a.name);
  const [nameAr, setNameAr] = useState("");
  const [nameCkb, setNameCkb] = useState("");
  const [reason, setReason] = useState("");

  function rename() {
    onDone(null);
    start(async () => {
      const r = await op.run("renameAccount", (key) =>
        renameAccountAction({ code: a.code, name, nameAr, nameCkb }, key),
      );
      if (!r.ok) return onDone({ ok: false, text: r.error });
      onDone({ ok: true, text: t("Account {code} is renamed.", { code: a.code }) });
      setOpen(null);
      router.refresh();
    });
  }

  function inUse() {
    onDone(null);
    start(async () => {
      const r = await op.run("setAccountInUse", (key) =>
        setAccountInUseAction({ code: a.code, inUse: !a.isActive, reason }, key),
      );
      if (!r.ok) return onDone({ ok: false, text: r.error });
      onDone({
        ok: true,
        text: a.isActive
          ? t("Account {code} is out of use.", { code: a.code })
          : t("Account {code} is in use again.", { code: a.code }),
      });
      setOpen(null);
      setReason("");
      router.refresh();
    });
  }

  const own = canChange && !a.isSystem;
  return (
    <tr data-testid="chart-row" data-code={a.code} className={a.isActive ? undefined : "muted"}>
      <td className="mono">{a.code}</td>
      <td data-label={t("Account")}>
        {say(a.name)}
        {!a.isActive && (
          <span className="badge" style={{ marginInlineStart: 6 }}>
            {t("Out of use")}
          </span>
        )}
        {open === "rename" && (
          <div className="grid" style={{ gap: 8, marginTop: 8, maxWidth: 520 }}>
            <Field label={t("Name (English)")}>
              <input
                style={inputStyle}
                lang="en"
                dir="ltr"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label={t("الاسم (Arabic)")}>
                <input
                  style={inputStyle}
                  dir="rtl"
                  value={nameAr}
                  maxLength={60}
                  onChange={(e) => setNameAr(e.target.value)}
                />
              </Field>
              <Field label={t("ناو (Kurdish)")}>
                <input
                  style={inputStyle}
                  dir="rtl"
                  value={nameCkb}
                  maxLength={60}
                  onChange={(e) => setNameCkb(e.target.value)}
                />
              </Field>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
              {t("Its names in Arabic and Kurdish stay as they are, unless new ones are given.")}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn-primary" disabled={busy || !name.trim()} onClick={rename}>
                {t("Save the name")}
              </button>
              <button type="button" onClick={() => setOpen(null)}>
                {t("Cancel")}
              </button>
              <OperationStatus op={op} />
            </div>
          </div>
        )}
        {open === "use" && (
          <div className="grid" style={{ gap: 8, marginTop: 8, maxWidth: 520 }}>
            <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
              {a.isActive
                ? t(
                    "Out of use, it takes no new posting; what was posted to it stays in every report.",
                  )
                : t("Back in use, it can be chosen again.")}
            </p>
            <Field label={t("Why (required)")}>
              <input
                style={inputStyle}
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn-primary" disabled={busy || !reason.trim()} onClick={inUse}>
                {a.isActive ? t("Take it out of use") : t("Put it back in use")}
              </button>
              <button type="button" onClick={() => setOpen(null)}>
                {t("Cancel")}
              </button>
              <OperationStatus op={op} />
            </div>
          </div>
        )}
      </td>
      <td className="muted" data-label={t("Type")}>
        {kind}
        {a.isSystem && <div style={{ fontSize: ".72rem" }}>{t("The system posts to it")}</div>}
      </td>
      <td className="right" style={{ whiteSpace: "nowrap" }}>
        {own && open === null && (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button type="button" onClick={() => setOpen("rename")}>
              {t("Rename…")}
            </button>
            <button type="button" onClick={() => setOpen("use")}>
              {a.isActive ? t("Take out of use…") : t("Bring back…")}
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

function AddAccount({ accounts, onDone }: { accounts: ChartAccount[]; onDone: (m: Msg) => void }) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [type, setType] = useState<"expense" | "revenue">("expense");
  const [code, setCode] = useState(() => nextFreeCode(accounts, "expense"));
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameCkb, setNameCkb] = useState("");

  function add() {
    onDone(null);
    start(async () => {
      const r = await op.run("createAccount", (key) =>
        createAccountAction({ code, name, type, nameAr, nameCkb }, key),
      );
      if (!r.ok) return onDone({ ok: false, text: r.error });
      onDone({
        ok: true,
        text: t("Account {code} {name} is added.", { code: r.data.code, name: r.data.name }),
      });
      setName("");
      setNameAr("");
      setNameCkb("");
      setCode(nextFreeCode([...accounts, { code: r.data.code }], type));
      router.refresh();
    });
  }

  return (
    <div className="card grid" style={{ gap: 10 }} data-testid="chart-add">
      <h4 style={{ margin: 0 }}>{t("Add an account")}</h4>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}
      >
        <Field label={t("Type")}>
          <select
            style={inputStyle}
            value={type}
            onChange={(e) => {
              const k = e.target.value === "revenue" ? "revenue" : "expense";
              setType(k);
              setCode(nextFreeCode(accounts, k));
            }}
          >
            <option value="expense">{t("A cost")}</option>
            <option value="revenue">{t("An income")}</option>
          </select>
        </Field>
        <Field label={t("Code")}>
          <input
            style={inputStyle}
            className="mono"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Field label={t("Name (English)")}>
          <input
            style={inputStyle}
            lang="en"
            dir="ltr"
            value={name}
            maxLength={60}
            placeholder={t("e.g. Repairs")}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label={t("الاسم (Arabic)")}>
          <input
            style={inputStyle}
            dir="rtl"
            value={nameAr}
            maxLength={60}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </Field>
        <Field label={t("ناو (Kurdish)")}>
          <input
            style={inputStyle}
            dir="rtl"
            value={nameCkb}
            maxLength={60}
            onChange={(e) => setNameCkb(e.target.value)}
          />
        </Field>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>
        {type === "revenue"
          ? t("An income's code is from 4000 to 4999.")
          : t(
              "A cost's code is from 5000 to 6999: 5… for the cost of what was sold, 6… for the running costs.",
            )}{" "}
        {t(
          "An asset, a debt or the owner's money is added by whoever looks after the system, so that the balance sheet and the cash flow know where it goes.",
        )}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          disabled={busy || !name.trim() || !/^\d{4}$/.test(code.trim())}
          onClick={add}
        >
          {t("Add the account")}
        </button>
        <OperationStatus op={op} />
      </div>
    </div>
  );
}
