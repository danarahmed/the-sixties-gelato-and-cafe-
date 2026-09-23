import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getCountSheet, getStockCounts } from "@/lib/db/read";
import { db, num, rows, str } from "@/lib/db/client";
import { dateTimeIn } from "@/lib/dates";
import { fmtIQD, fmtQty } from "@/lib/format";
import { CountSheet, ReviewActions, StartCount } from "@/components/CountClient";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  counting: "warn",
  submitted: "warn",
  approved: "ok",
  rejected: "err",
};

/**
 * Blind, two-person stock counts (audit H-12). The counter sees item names
 * only; what the ledger expects is snapshotted by the database when the count
 * opens and is never sent to them. Someone else reviews expected against
 * counted and approves, and only then are the variances posted.
 */
export default async function CountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission(
    "inventory.count",
    "inventory.count.view_expected",
    "inventory.adjust.approve",
  );
  const t = await getT();
  const sp = await searchParams;
  const counts = await getStockCounts();
  const canCount = has(profile, "inventory.count");
  const canReview = has(profile, "inventory.count.view_expected");
  const canApprove = has(profile, "inventory.adjust.approve");

  const mine = counts.find((c) => c.status === "counting" && c.countedById === profile.id);
  const sheet = mine ? await getCountSheet(mine.id) : [];

  const reviewId = typeof sp.review === "string" ? sp.review : null;
  const reviewing = reviewId ? counts.find((c) => c.id === reviewId) : undefined;
  let review: {
    itemId: string;
    name: string;
    expected: number;
    counted: number;
    variance: number;
    value: number;
  }[] = [];
  if (reviewing && canReview) {
    const c = await db();
    review = rows(
      await c.rpc("review_stock_count", { p_count: reviewing.id }),
      "the count review",
    ).map((r: Record<string, unknown>) => ({
      itemId: str(r.item_id),
      name: str(r.item_name),
      expected: num(r.expected),
      counted: num(r.counted),
      variance: num(r.variance),
      value: num(r.variance_value),
    }));
  }
  const withVariance = review.filter((r) => r.variance !== 0);

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>{t("nav.count")}</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
        <strong>Blind count.</strong> Count what is on the shelf; the expected quantities are never
        shown to the person counting. When the count is submitted, a manager — never the counter —
        reviews it and approves the variances into the books.
      </p>

      {canCount && (mine ? <CountSheet countId={mine.id} lines={sheet} /> : <StartCount />)}

      {reviewing && canReview && (
        <section className="card tw">
          <h3 style={{ marginTop: 0 }}>
            Review — count of {dateTimeIn(profile.timezone, reviewing.startedAt)} by{" "}
            {reviewing.countedBy ?? "—"}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="right">Expected</th>
                <th className="right">Counted</th>
                <th className="right">Variance</th>
                <th className="right">Value</th>
              </tr>
            </thead>
            <tbody>
              {review.map((r) => (
                <tr key={r.itemId}>
                  <td>{r.name}</td>
                  <td className="right mono">{fmtQty(r.expected)}</td>
                  <td className="right mono">{fmtQty(r.counted)}</td>
                  <td
                    className="right mono"
                    style={{
                      color:
                        r.variance < 0 ? "var(--err)" : r.variance > 0 ? "var(--ok)" : undefined,
                    }}
                  >
                    {r.variance > 0 ? "+" : ""}
                    {fmtQty(r.variance)}
                  </td>
                  <td className="right mono">{r.value === 0 ? "—" : fmtIQD(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: ".82rem" }}>
            {withVariance.length} item(s) differ; net value{" "}
            {fmtIQD(withVariance.reduce((s, r) => s + r.value, 0))}. Approving posts them against
            5400 Inventory count variance, dated when the count was submitted.
          </p>
          {reviewing.status === "submitted" && canApprove && (
            <ReviewActions
              countId={reviewing.id}
              countedByMe={reviewing.countedById === profile.id}
            />
          )}
        </section>
      )}

      <section className="card tw">
        <h3 style={{ marginTop: 0 }}>Counts</h3>
        {counts.length === 0 ? (
          <EmptyState title="No counts yet" hint="Start the first count above." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Counter</th>
                <th className="right">Counted</th>
                <th>Status</th>
                <th>Approved / rejected by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.id}>
                  <td className="mono muted" style={{ fontSize: ".8rem" }}>
                    {dateTimeIn(profile.timezone, c.startedAt)}
                  </td>
                  <td>{c.countedBy ?? "—"}</td>
                  <td className="right mono">
                    {c.counted}/{c.lines}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[c.status] ?? ""}`}>{c.status}</span>
                    {c.rejectedReason && (
                      <div className="muted" style={{ fontSize: ".75rem" }}>
                        {c.rejectedReason}
                      </div>
                    )}
                  </td>
                  <td className="muted">{c.approvedBy ?? "—"}</td>
                  <td className="right">
                    {canReview && c.status !== "counting" && (
                      <Link href={`/count?review=${c.id}`} className="badge">
                        Review
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
