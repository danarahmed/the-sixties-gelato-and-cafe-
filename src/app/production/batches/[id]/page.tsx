import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { arrows } from "@/lib/i18n/core";
import { getDir, getLocale, getMsg, getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getItems } from "@/lib/db/read";
import { getBatchReconciliation } from "@/lib/db/production";
import { dateTimeIn } from "@/lib/dates";
import {
  STORY_LABEL,
  STORY_PARTS,
  lotMovementLabel,
  storyAddsUp,
  type StoryPart,
} from "@/lib/production";
import { SetUseBy } from "@/components/production/Lots";
import { labelsFor, showIn, showNice } from "@/components/production/batchMath";
import { BatchLabels } from "@/components/production/BatchLabels";

export const dynamic = "force-dynamic";

/** The parts of a batch's story that are signed: a count or a correction may add or take away. */
const SIGNED: readonly StoryPart[] = ["counted", "corrected"];

/**
 * One batch (0046): when it was made and by whom, what was planned and what
 * came out, its use-by, and what became of every gram of it — sold, used in
 * other batches, lost, found or missing on a count, left — with each movement
 * of its lot. A manager changes its use-by here, with why.
 */
export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission("cost.view", "production.record");
  const t = await getT();
  const { back } = arrows(await getDir());
  const msg = await getMsg();
  const locale = await getLocale();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [b, items] = await Promise.all([getBatchReconciliation(id), getItems()]);
  if (!b) notFound();
  const item = items.find((i) => i.id === b.itemId);
  const units = item ? { baseUnit: item.baseUnit, units: item.units } : undefined;
  const q = (n: number) => showNice(new Decimal(n), units, b.baseUnit, t);
  const signed = (n: number) => (n > 0 ? `+${q(n)}` : q(n));
  const cancelled = b.status === "cancelled";
  const at = (iso: string) => dateTimeIn(profile.timezone, iso);
  // A batch sent from the kitchen to the branch is at two places (0054).
  const places = new Set(b.movements.map((m) => m.place));
  // What is in its pans, as the reader calls it.
  const name = (locale === "ar" ? item?.nameAr : locale === "ckb" ? item?.nameCkb : null) || b.item;

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="batch-page">
      <div className="phead">
        <h1>{t("Batch {no}: {recipe}", { no: b.batchNo, recipe: b.recipe })}</h1>
        <Link href="/production" className="sc">
          {back} {t("nav.production")}
        </Link>
      </div>

      <section className="card grid" style={{ gap: 6, fontSize: ".9rem" }}>
        <div>
          {t("Made {when} by {who}", { when: at(b.madeAt), who: b.madeBy ?? "—" })}
          {b.lateReason && (
            <>
              {" · "}
              <span className="badge warn">{t("recorded late")}</span>{" "}
              {t("recorded {when}: {why}", { when: at(b.recordedAt), why: b.lateReason })}
            </>
          )}
        </div>
        <div>
          {t("Came out: {actual} of the {planned} its recipe makes", {
            actual: showIn(new Decimal(b.actual), units, b.enteredUnit, t),
            planned: showIn(new Decimal(b.planned), units, b.enteredUnit, t),
          })}
          {" · "}
          <Link href={`/inventory/${b.itemId}`}>{b.item}</Link>
        </div>
        <div data-testid="batch-use-by">
          {b.useBy
            ? t("To be used by {when}", { when: at(b.useBy) })
            : t("No use-by: its recipe keeps no shelf life.")}
        </div>
        {b.note && <div className="muted">{b.note}</div>}
        {cancelled && (
          <div>
            <span className="badge warn">{t("cancelled")}</span> {b.cancelReason}
            {b.cancelledAt ? ` — ${at(b.cancelledAt)}` : ""}
          </div>
        )}
        {!cancelled && (
          <BatchLabels
            batch={{
              batchNo: b.batchNo,
              name,
              made: q(b.actual),
              madeAt: b.madeAt,
              useBy: b.useBy,
              place: b.movements.find((m) => m.kind === "made" && m.qty > 0)?.place ?? null,
              madeBy: b.madeBy,
              lot: b.lot,
            }}
            businessName={profile.businessName}
            timezone={profile.timezone}
            pans={labelsFor(b.actual, b.enteredUnit, units)}
          />
        )}
        {has(profile, "inventory.adjust.approve") && !cancelled && b.lot && (
          <div style={{ marginTop: 6 }}>
            <SetUseBy batchId={b.batchId} useBy={b.useBy} timezone={profile.timezone} compact />
          </div>
        )}
      </section>

      <section className="panel" data-testid="batch-story">
        <div className="panel-h">
          <h3>{t("What became of it")}</h3>
          {b.lot && <span className="muted mono">{b.lot}</span>}
        </div>
        <div className="panel-b grid" style={{ gap: 10 }}>
          {!b.story ? (
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
              {t(
                "Made before batches were kept apart in stock: what became of it is not known batch by batch.",
              )}
            </p>
          ) : (
            <>
              <div className="tw">
                <table>
                  <tbody>
                    <tr>
                      <td>{t(STORY_LABEL.made)}</td>
                      <td className="right mono" data-testid="story-made">
                        {q(b.story.made)}
                      </td>
                    </tr>
                    {STORY_PARTS.filter((p) => p === "left" || b.story![p] !== 0).map((p) => (
                      <tr key={p} data-testid={`story-${p}`}>
                        <td>{t(STORY_LABEL[p])}</td>
                        <td className="right mono">
                          {p === "left"
                            ? q(b.story![p])
                            : SIGNED.includes(p)
                              ? signed(b.story![p])
                              : `−${q(b.story![p])}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                className={storyAddsUp(b.story) ? "muted" : "pr-short"}
                style={{ margin: 0, fontSize: ".8rem" }}
                data-testid="story-check"
              >
                {!storyAddsUp(b.story)
                  ? t("It does not add up: tell the owner.")
                  : b.story.moved !== 0
                    ? t(
                        "Every bit accounted for: made = sold + used + lost + on its way ± counts + left.",
                      )
                    : t("Every bit accounted for: made = sold + used + lost ± counts + left.")}
              </p>
            </>
          )}
        </div>
      </section>

      {b.movements.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>{t("Each movement of the batch")}</h3>
          </div>
          <div className="tw">
            <table data-testid="batch-movements">
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  {places.size > 1 && <th>{t("Place")}</th>}
                  <th>{t("What")}</th>
                  <th className="right">{t("Quantity")}</th>
                  <th>{t("By")}</th>
                  <th>{t("Note")}</th>
                </tr>
              </thead>
              <tbody>
                {b.movements.map((m, i) => (
                  <tr key={i}>
                    <td className="muted mono" style={{ fontSize: ".8rem" }}>
                      {at(m.at)}
                    </td>
                    {places.size > 1 && <td>{m.place ?? "—"}</td>}
                    <td>{t(lotMovementLabel(m.kind, m.qty, m.referenceType))}</td>
                    <td className="right mono">{signed(m.qty)}</td>
                    <td className="muted">{m.by ?? "—"}</td>
                    <td className="muted" style={{ fontSize: ".8rem" }}>
                      {m.reason ? msg(m.reason) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
