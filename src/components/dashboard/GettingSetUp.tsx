"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon, type IconName } from "@/components/Icon";
import { SETUP_HIDE_COOKIE, SETUP_SKIP_COOKIE, type SetupKey, type SetupStep } from "@/lib/setup";

const ICON: Record<SetupKey, IconName> = {
  items: "box",
  suppliers: "vendors",
  recipes: "bowl",
  products: "cone",
  tables: "table",
  staff: "staff",
  sale: "cash",
};

/** A year on this device: the café's choice, not the person's mood. */
const keep = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
};

/**
 * Getting set up (round seven), on the dashboard of a café still being set
 * up: each step in the order it is needed, ticked once the café has one, its
 * button opening the form it is added in; the next one lit. A step the café
 * does without is put aside, on this device, and can be put back; the list
 * can be hidden here altogether.
 */
export function GettingSetUp({
  steps: initial,
  staffWithoutPin,
}: {
  steps: SetupStep[];
  staffWithoutPin: number;
}) {
  const { t } = useT();
  const [skipped, setSkipped] = useState(
    () => new Set(initial.filter((s) => s.skipped).map((s) => s.key)),
  );
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  // The next step, as the steps put aside now have it.
  let found = false;
  const steps = initial.map((s) => {
    const off = s.optional && !s.done && skipped.has(s.key);
    const next = !found && !s.done && !off;
    if (next) found = true;
    return { ...s, skipped: off, next };
  });
  const counted = steps.filter((s) => !s.skipped);
  const done = counted.filter((s) => s.done).length;

  const setSkip = (key: SetupKey, on: boolean) => {
    const next = new Set(skipped);
    if (on) next.add(key);
    else next.delete(key);
    setSkipped(next);
    keep(SETUP_SKIP_COOKIE, [...next].join(","));
  };

  return (
    <section className="card setup no-print" aria-labelledby="setup-title" data-testid="setup">
      <header className="setup-head">
        <div>
          <h2 id="setup-title">{t("Getting set up")}</h2>
          <p className="muted">{t("Add these in order, and the café is ready to sell.")}</p>
        </div>
        <div className="setup-progress" data-testid="setup-progress">
          <span>{t("{done} of {total} done", { done, total: counted.length })}</span>
          <span className="setup-bar" aria-hidden="true">
            <span style={{ width: `${counted.length ? (done / counted.length) * 100 : 0}%` }} />
          </span>
        </div>
      </header>
      <ol className="setup-steps">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`setup-step${s.done ? " done" : ""}${s.next ? " next" : ""}${s.skipped ? " skipped" : ""}`}
            data-testid="setup-step"
            data-step={s.key}
            data-state={s.done ? "done" : s.skipped ? "skipped" : s.next ? "next" : "todo"}
          >
            <span className="setup-mark" aria-hidden="true">
              {s.done ? <Icon name="ok" size={16} /> : i + 1}
            </span>
            <span className="setup-icon" aria-hidden="true">
              <Icon name={ICON[s.key]} size={18} />
            </span>
            <div className="setup-body">
              <strong>
                {t(s.title)}
                {s.next && <span className="badge setup-next">{t("Next")}</span>}
              </strong>
              {!s.done && !s.skipped && <span className="muted">{t(s.text)}</span>}
              {s.done && s.key === "staff" && staffWithoutPin > 0 && (
                <span className="setup-note" data-testid="setup-no-pin">
                  <Link href="/staff#people">
                    {t("{n} without a PIN yet", { n: staffWithoutPin })}
                  </Link>
                </span>
              )}
            </div>
            <div className="setup-act">
              {s.done ? (
                <span className="setup-count">
                  {s.key === "sale" ? t("Done") : t("{n} added", { n: s.count })}
                </span>
              ) : s.skipped ? (
                <>
                  <span className="muted">{t("Not needed here")}</span>
                  <button
                    type="button"
                    className="setup-link"
                    onClick={() => setSkip(s.key, false)}
                    data-testid="setup-unskip"
                  >
                    {t("Put back")}
                  </button>
                </>
              ) : s.can ? (
                <>
                  <Link
                    href={s.href}
                    className={s.next ? "btn-primary" : "btn-soft"}
                    data-testid="setup-go"
                  >
                    {t(s.action)}
                  </Link>
                  {s.optional && (
                    <button
                      type="button"
                      className="setup-link"
                      onClick={() => setSkip(s.key, true)}
                      data-testid="setup-skip"
                    >
                      {t("Not needed")}
                    </button>
                  )}
                </>
              ) : (
                <span className="muted setup-theirs">
                  {t("The owner or a manager adds these.")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <footer className="setup-foot">
        <button
          type="button"
          className="setup-link"
          onClick={() => {
            keep(SETUP_HIDE_COOKIE, "1");
            setHidden(true);
          }}
          data-testid="setup-hide"
        >
          {t("Hide this list")}
        </button>
      </footer>
    </section>
  );
}
