"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDownAction, stopMarkdownAction } from "@/lib/actions/markdowns";
import { markedDown, type MarkdownBoard } from "@/lib/markdowns";
import { dateTimeIn } from "@/lib/dates";
import { fmtIQD, withSize } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { Icon } from "@/components/Icon";

const CHOICES = [20, 30, 50];

/**
 * Sell it before it goes (0079): the batches whose use-by ends today with
 * some left, each with the sizes that sell them, marked down in one tap until
 * the day ends — the suggested percentage first; and what is marked down now,
 * stopped with a tap.
 */
export function MarkdownsCard({ board, timezone }: { board: MarkdownBoard; timezone: string }) {
  const { t, msg } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function mark(variantIds: string[], percent: number) {
    setError(null);
    start(async () => {
      const r = await op.run(`markdown:${variantIds.join(",")}:${percent}`, (key) =>
        markDownAction({ variantIds, percent }, key),
      );
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }
  function stop(id: string) {
    setError(null);
    start(async () => {
      const r = await op.run(`markdown-stop:${id}`, (key) => stopMarkdownAction(id, key));
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  if (board.lots.length === 0 && board.running.length === 0) return null;
  const time = (iso: string) => dateTimeIn(timezone, iso).slice(11);

  return (
    <section className="card grid markdowns" style={{ gap: 10 }} data-testid="markdowns">
      <h2 style={{ margin: 0 }}>
        <Icon name="tag" /> {t("Sell it before it goes")}
      </h2>
      {board.lots.length > 0 && (
        <p className="muted" style={{ margin: 0 }}>
          {t(
            "What must be sold today, with some left. Marked down, it sells for less until the day ends; the till shows by how much.",
          )}
        </p>
      )}
      {board.lots.map((l) => {
        const sizes = l.sizes;
        const ids = sizes.map((s) => s.variantId);
        return (
          <div key={l.lotId} className="markdown-lot" data-testid="markdown-lot" data-item={l.item}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
              <b>{l.item}</b>
              <span className="muted">
                {t("{left} left, use by {time}", { left: l.left, time: time(l.useBy) })}
              </span>
            </div>
            {sizes.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                {t("No size on the menu sells it.")}
              </p>
            ) : (
              <>
                <div className="muted" style={{ fontSize: ".85rem" }}>
                  {sizes
                    .map(
                      (s) =>
                        `${withSize(s.product, s.size)}: ${t("{n} to sell", { n: s.servings })}`,
                    )
                    .join(" · ")}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[l.suggested, ...CHOICES.filter((c) => c !== l.suggested)].map((p, i) => (
                    <button
                      key={p}
                      type="button"
                      className={i === 0 ? "btn-primary" : undefined}
                      disabled={busy}
                      onClick={() => mark(ids, p)}
                      data-testid="markdown-apply"
                      data-percent={p}
                    >
                      {t("{percent}% off", { percent: p })}
                      {sizes[0]?.price != null && (
                        <span className="mono"> · {fmtIQD(markedDown(sizes[0].price, p))}</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
      {board.running.length > 0 && (
        <div className="grid" style={{ gap: 6 }}>
          <strong>{t("Marked down now")}</strong>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {board.running.map((m) => (
              <li key={m.id} data-testid="markdown-running">
                {withSize(m.product, m.size)} · {t("{percent}% off", { percent: m.percent })} ·{" "}
                {t("until {time}", { time: time(m.endsAt) })}{" "}
                <button
                  type="button"
                  className="linklike"
                  disabled={busy}
                  onClick={() => stop(m.id)}
                  data-testid="markdown-stop"
                >
                  {t("Stop")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className="red" role="alert" style={{ margin: 0 }}>
          {msg(error)}
        </p>
      )}
      <OperationStatus op={op} />
    </section>
  );
}
