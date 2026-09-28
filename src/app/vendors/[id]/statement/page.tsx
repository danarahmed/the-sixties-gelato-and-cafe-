import Link from "next/link";
import { notFound } from "next/navigation";
import { getMsg, getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getSupplierStatement } from "@/lib/db/purchasing";
import { fmtIQD } from "@/lib/format";
import { businessToday, monthStart, parseDay } from "@/lib/dates";
import { CREDIT_KIND_LABEL, type StatementLine } from "@/lib/purchasing";
import { PrintDocument } from "@/components/PrintDocument";

export const dynamic = "force-dynamic";

/** What a credit was for, as a line of the statement says it (the same words as Vendors). */
const CREDIT_FOR = {
  goods_return: "Credit — goods returned",
  price: "Credit — a lower price",
  other: "Credit — other",
} as const;

/**
 * A supplier's statement between two dates (0044, supplier_statement): what
 * was owed before them, each bill, cancelled bill, payment and credit with the
 * balance after it, what was owed at the end; then the bills still owed and
 * the credits not yet all set against a bill. Printed, it is what the café
 * sends the supplier to agree the account.
 */
export default async function SupplierStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const msg = await getMsg();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const today = businessToday(profile.timezone);
  const from = parseDay(sp.from, monthStart(today));
  const to = parseDay(sp.to, today);
  // A supplier that is not the café's (or no longer anyone's) has no statement.
  const s = await getSupplierStatement(id, from <= to ? from : to, to).catch((e: unknown) => {
    if (e instanceof Error && /Supplier not found/.test(e.message)) notFound();
    throw e;
  });

  const what = (l: StatementLine): string => {
    switch (l.kind) {
      case "bill":
        return msg(`Bill ${l.ref ?? ""}`.trim());
      case "cancelled":
        return msg(`Cancelled bill ${l.ref ?? ""}: ${l.note ?? ""}`);
      case "payment":
        return l.bill ? msg(`Payment — bill ${l.bill}`) : t("Payment");
      case "credit":
        return msg(CREDIT_FOR[l.creditKind ?? "other"]);
    }
  };
  const ref = (l: StatementLine): string => {
    const parts: string[] = [];
    if (l.kind === "credit" && l.creditNo !== null)
      parts.push(
        l.ref
          ? t("Credit {no}, their note {ref}", { no: l.creditNo, ref: l.ref })
          : t("Credit {no}", { no: l.creditNo }),
      );
    if (l.returnNo !== null) parts.push(t("return {no}", { no: l.returnNo }));
    if (l.receiptNo !== null) parts.push(t("delivery {no}", { no: l.receiptNo }));
    if (l.kind === "bill" && l.due) parts.push(t("Due {date}", { date: l.due }));
    return parts.join(" · ");
  };

  const statement = (
    <div className="stmt" data-testid="supplier-statement">
      <div className="stmt-top">
        <div className="serif" style={{ fontSize: "1.15rem", fontWeight: 700 }}>
          {profile.businessName}
        </div>
        <div className="muted" style={{ fontSize: ".76rem", textAlign: "end" }}>
          <strong>{t("To")}</strong>
          <br />
          {s.supplier.name}
          {s.supplier.contact && (
            <>
              <br />
              {s.supplier.contact}
            </>
          )}
          {s.supplier.phone && (
            <>
              <br />
              {s.supplier.phone}
            </>
          )}
        </div>
      </div>
      <div className="masthead" style={{ paddingBlockEnd: 0 }}>
        <div className="doc" style={{ fontSize: "1.02rem", fontStyle: "normal", fontWeight: 600 }}>
          {t("Statement of Account")}
        </div>
        <div className="period">{t("{from} to {to} · IQD", { from: s.from, to: s.to })}</div>
      </div>
      <div className="rule-band" style={{ marginBlockEnd: 14 }} />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("Date")}</th>
              <th>{t("Particulars")}</th>
              <th>{t("Ref")}</th>
              <th className="right">{t("Charge")}</th>
              <th className="right">{t("Payment")}</th>
              <th className="right">{t("Balance")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{s.from}</td>
              <td>{t("Owed before {day}", { day: s.from })}</td>
              <td />
              <td className="right money">—</td>
              <td className="right money">—</td>
              <td className="right money" data-testid="statement-opening">
                {fmtIQD(s.opening)}
              </td>
            </tr>
            {s.lines.map((l) => (
              <tr key={`${l.kind}-${l.id}`}>
                <td>{l.date}</td>
                <td>{what(l)}</td>
                <td className="ref">{ref(l)}</td>
                <td className="right money">{l.charge ? fmtIQD(l.charge) : "—"}</td>
                <td className="right money">{l.credit ? `(${fmtIQD(l.credit)})` : "—"}</td>
                <td className="right money">{fmtIQD(l.balance)}</td>
              </tr>
            ))}
            <tr>
              <td>{s.to}</td>
              <td>
                <strong>{t("Owed on {day}", { day: s.to })}</strong>
              </td>
              <td />
              <td className="right money">—</td>
              <td className="right money">—</td>
              <td className="right money" data-testid="statement-closing">
                <strong>{fmtIQD(s.closing)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: ".82rem" }} data-testid="statement-totals">
        {t("Billed {billed} · cancelled {cancelled} · paid {paid} · credited {credited}", {
          billed: fmtIQD(s.billed),
          cancelled: fmtIQD(s.cancelled),
          paid: fmtIQD(s.paid),
          credited: fmtIQD(s.credited),
        })}
      </p>
      {s.openBills.length > 0 && (
        <div className="tw">
          <div className="sc">{t("Open bills")}</div>
          <table data-testid="statement-open-bills">
            <thead>
              <tr>
                <th>{t("Bill")}</th>
                <th>{t("Date")}</th>
                <th>{t("Due")}</th>
                <th className="right">{t("Total")}</th>
                <th className="right">{t("Paid")}</th>
                <th className="right">{t("Credited")}</th>
                <th className="right">{t("Outstanding")}</th>
              </tr>
            </thead>
            <tbody>
              {s.openBills.map((b) => (
                <tr key={b.billId}>
                  <td className="mono">{b.invoiceNo}</td>
                  <td>{b.date}</td>
                  <td>{b.due ?? "—"}</td>
                  <td className="right money">{fmtIQD(b.total)}</td>
                  <td className="right money">{fmtIQD(b.paid)}</td>
                  <td className="right money">{fmtIQD(b.credited)}</td>
                  <td className="right money">{fmtIQD(b.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.openCredits.length > 0 && (
        <div className="tw">
          <div className="sc">{t("Credits not yet set against a bill")}</div>
          <table data-testid="statement-open-credits">
            <thead>
              <tr>
                <th>{t("No.")}</th>
                <th>{t("Date")}</th>
                <th>{t("For")}</th>
                <th>{t("Their note")}</th>
                <th className="right">{t("Amount")}</th>
                <th className="right">{t("Left")}</th>
              </tr>
            </thead>
            <tbody>
              {s.openCredits.map((c) => (
                <tr key={c.creditId}>
                  <td className="mono">{c.creditNo}</td>
                  <td>{c.date}</td>
                  <td>{t(CREDIT_KIND_LABEL[c.kind])}</td>
                  <td>{c.supplierRef ?? t("Awaiting their note")}</td>
                  <td className="right money">{fmtIQD(c.amount)}</td>
                  <td className="right money">{fmtIQD(c.left)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="statement-page">
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{s.supplier.name}</h1>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 10 }}>
          <PrintDocument label={t("Print the statement")}>{statement}</PrintDocument>
          <Link href="/vendors">{t("Back to Vendors")}</Link>
        </span>
      </div>
      <form
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label>
          <div className="sc">{t("From")}</div>
          <input type="date" name="from" defaultValue={s.from} />
        </label>
        <label>
          <div className="sc">{t("To")}</div>
          <input type="date" name="to" defaultValue={s.to} />
        </label>
        <button type="submit">{t("Show")}</button>
      </form>
      <div className="card">{statement}</div>
    </div>
  );
}
