import { getT } from "@/lib/i18n/server";
import { talabatPayout, settlementReport, TALABAT_ORDER } from "@/lib/demo/data";

const ISSUE_LABEL: Record<string, string> = {
  missing_payout: "Missing payout",
  unmatched_settlement_line: "Unmatched settlement line",
  duplicate_settlement_line: "Duplicate settlement line",
  payout_difference: "Payout difference",
  incorrect_commission: "Incorrect commission",
  cancelled_still_charged: "Cancelled but charged",
  unexplained_adjustment: "Unexplained adjustment",
};

export default async function PlatformsPage() {
  const t = await getT();
  const { payout, cogs, contribution } = talabatPayout();
  const { report } = settlementReport();
  const e = TALABAT_ORDER;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="demo-banner">⚠️ {t("common.demo")}</div>
      <h1 style={{ margin: 0 }}>{t("nav.platforms")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        The customer&apos;s payment is <strong>not</strong> your revenue or your payout. Every
        component is stored separately and the payout is computed deterministically. Talabat live
        API needs Partner credentials; until then, CSV import + this reconciliation work today.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Talabat order TLB-2026-0001 — economics</h3>
        <table>
          <tbody>
            <Row label="Merchant list value" v={e.merchantListValue.format()} />
            <Row
              label="Merchant-funded discount"
              v={"−" + e.merchantFundedDiscount.format()}
              muted
            />
            <Row
              label="Platform-funded discount (reimbursed)"
              v={e.platformFundedDiscount.format()}
              muted
            />
            <Row label="Net merchant sales" v={payout.netMerchantSales.format()} strong />
            <Row label="Commission" v={"−" + e.commission.format()} muted />
            <Row label="Payment processing fee" v={"−" + e.paymentProcessingFee.format()} muted />
            <Row label="Advertising fee" v={"−" + e.advertisingFee.format()} muted />
            <Row label="Refunds" v={"−" + e.refunds.format()} muted />
            <Row label="Expected merchant payout" v={payout.expectedPayout.format()} strong />
            <Row label="Product cost (COGS)" v={"−" + cogs.format()} muted />
            <Row label="Channel contribution profit" v={contribution.format()} strong ok />
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Settlement reconciliation — statement TLB-SETTLE-2026-W32</h3>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="badge">Matched: {report.matchedCount}</span>
          <span className="badge">Expected total: {report.totalExpected.format()}</span>
          <span className="badge">Reported total: {report.totalReported.format()}</span>
          <span className={`badge ${report.issues.length ? "err" : "ok"}`}>
            Issues: {report.issues.length}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Issue</th>
              <th>Order</th>
              <th>Detail</th>
              <th className="right">Impact</th>
            </tr>
          </thead>
          <tbody>
            {report.issues.map((i, idx) => (
              <tr key={idx}>
                <td>
                  <span className="badge err">{ISSUE_LABEL[i.type] ?? i.type}</span>
                </td>
                <td className="mono">{i.externalOrderId}</td>
                <td className="muted" style={{ fontSize: ".9rem" }}>
                  {i.detail}
                </td>
                <td className="right mono">{i.delta ? i.delta.format() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  v,
  strong,
  muted,
  ok,
}: {
  label: string;
  v: string;
  strong?: boolean;
  muted?: boolean;
  ok?: boolean;
}) {
  return (
    <tr>
      <td style={{ fontWeight: strong ? 700 : 400 }} className={muted ? "muted" : ""}>
        {label}
      </td>
      <td
        className="right mono"
        style={{ fontWeight: strong ? 700 : 400, color: ok ? "var(--ok)" : undefined }}
      >
        {v}
      </td>
    </tr>
  );
}
