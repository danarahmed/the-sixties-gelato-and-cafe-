import Link from "next/link";
import { getMsg, getT } from "@/lib/i18n/server";
import { Rich } from "@/lib/i18n/Rich";
import { has, requirePermission } from "@/lib/auth/session";
import { getCountSheet, getStockCounts } from "@/lib/db/read";
import { db, num, rows, str } from "@/lib/db/client";
import { dateTimeIn } from "@/lib/dates";
import { fmtIQD, fmtQty } from "@/lib/format";
import { CancelCount, CountSheet, ReviewActions, StartCount } from "@/components/CountClient";
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
  const msg = await getMsg();
  const sp = await searchParams;
  const counts = await getStockCounts();
  const canCount = has(profile, "inventory.count");
  const canReview = has(profile, "inventory.count.view_expected");
  const canApprove = has(profile, "inventory.adjust.approve");

  const mine = counts.find((c) => c.status === "counting" && c.countedById === profile.id);
  // One count at a time: two open counts would each post the same difference.
  const othersOpen = counts.find((c) => c.status === "counting" && c.countedById !== profile.id);
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
        <Rich
          text={t(
            "<b>Blind count.</b> Count what is on the shelf; the expected quantities are never shown to the person counting. Each item is compared with the stock at the moment it is counted, so the café can keep trading during a count. When the count is submitted, a manager — never the counter — reviews it and approves the variances into the books.",
          )}
        />
      </p>

      {canCount && mine && (
        <>
          <CountSheet countId={mine.id} lines={sheet} />
          <div>
            <CancelCount countId={mine.id} label={t("your count")} />
          </div>
        </>
      )}
      {othersOpen && !mine && (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <span>
            {canApprove
              ? t(
                  "A count is open: started {when} by {who}. Only one count is open at a time; it is finished by its counter, or cancelled here.",
                  {
                    when: dateTimeIn(profile.timezone, othersOpen.startedAt),
                    who: othersOpen.countedBy ?? t("someone"),
                  },
                )
              : t(
                  "A count is open: started {when} by {who}. Only one count is open at a time; it is finished by its counter.",
                  {
                    when: dateTimeIn(profile.timezone, othersOpen.startedAt),
                    who: othersOpen.countedBy ?? t("someone"),
                  },
                )}
          </span>
          {canApprove && (
            <div>
              <CancelCount countId={othersOpen.id} label={t("the open count")} />
            </div>
          )}
        </div>
      )}
      {canCount && !mine && !othersOpen && <StartCount />}

      {reviewing && canReview && (
        <section className="card tw">
          <h3 style={{ marginTop: 0 }}>
            {t("Review — count of {when} by {who}", {
              when: dateTimeIn(profile.timezone, reviewing.startedAt),
              who: reviewing.countedBy ?? "—",
            })}
          </h3>
          <table>
            <thead>
              <tr>
                <th>{t("Item")}</th>
                <th className="right">{t("Expected")}</th>
                <th className="right">{t("Counted")}</th>
                <th className="right">{t("Variance")}</th>
                <th className="right">{t("Value")}</th>
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
            {t(
              "{n} item(s) differ; net value {value}. Expected is the stock at the moment each item was counted. Approving posts the differences against 5400 Inventory count variance, dated when the count was submitted.",
              {
                n: withVariance.length,
                value: fmtIQD(withVariance.reduce((s, r) => s + r.value, 0)),
              },
            )}
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
        <h3 style={{ marginTop: 0 }}>{t("Counts")}</h3>
        {counts.length === 0 ? (
          <EmptyState title={t("No counts yet")} hint={t("Start the first count above.")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("Started")}</th>
                <th>{t("Counter")}</th>
                <th className="right">{t("Counted")}</th>
                <th>{t("Status")}</th>
                <th>{t("Approved / rejected by")}</th>
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
                    <span className={`badge ${STATUS_BADGE[c.status] ?? ""}`}>{t(c.status)}</span>
                    {c.rejectedReason && (
                      <div className="muted" style={{ fontSize: ".75rem" }}>
                        {msg(c.rejectedReason)}
                      </div>
                    )}
                  </td>
                  <td className="muted">{c.approvedBy ?? "—"}</td>
                  <td className="right">
                    {canReview && c.status !== "counting" && (
                      <Link href={`/count?review=${c.id}`} className="badge">
                        {t("Review")}
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
