"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { helpForAction } from "@/lib/actions/help";
import type { HelpForScreen } from "@/lib/help/match";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * The ? on every screen (G3): this screen's help, for the person's own role,
 * in their language. What the screen is for, what they may do there, the
 * tasks of their role that use it step by step, what to do when…, and tips.
 * Taken from the guide (scripts/help/extract.mjs).
 */
export function HelpButton() {
  const { t } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState<{ path: string; data: HelpForScreen | null } | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  // Another screen: its own help, when opened again.
  useEffect(() => setOpen(false), [pathname]);

  function show() {
    setOpen(true);
    const path = pathname ?? "/";
    start(async () => setHelp({ path, data: await helpForAction(path).catch(() => null) }));
  }

  const data = help?.path === pathname ? help.data : null;
  const empty = !busy && data !== null && data.screens.length === 0 && data.tasks.length === 0;
  return (
    <>
      <button
        type="button"
        className="help-button"
        aria-label={t("Help for this screen")}
        title={t("Help for this screen")}
        onClick={show}
        data-testid="help-button"
      >
        ?
      </button>
      {open && (
        <div className="help-scrim" onClick={() => setOpen(false)}>
          <aside
            className="help-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t("Help for this screen")}
            onClick={(e) => e.stopPropagation()}
            data-testid="help-panel"
          >
            <div className="help-head">
              <strong>{t("Help for this screen")}</strong>
              <button type="button" onClick={() => setOpen(false)} data-testid="help-close">
                {t("Close")}
              </button>
            </div>
            {busy || !data ? (
              <p className="muted">{busy ? "…" : t("No help is written for this screen yet.")}</p>
            ) : empty ? (
              <p className="muted">{t("No help is written for this screen yet.")}</p>
            ) : (
              <div className="help-body">
                {data.screens.map((s, i) => (
                  <section key={i} data-testid="help-screen">
                    <h3>{s.title}</h3>
                    <p>{s.summary}</p>
                    {s.you.length > 0 && (
                      <>
                        <h4>{t("What you can do here")}</h4>
                        {s.you.map((y, j) => (
                          <p key={j}>{y}</p>
                        ))}
                      </>
                    )}
                    {s.get_there && (
                      <p className="muted">
                        <b>{t("How to get here")}:</b> {s.get_there}
                      </p>
                    )}
                    {s.what_if.length > 0 && (
                      <details>
                        <summary>{t("If…")}</summary>
                        <dl>
                          {s.what_if.map((w, j) => (
                            <div key={j}>
                              <dt>{w.case}</dt>
                              <dd>{w.do}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                    {s.tips.length > 0 && (
                      <details>
                        <summary>{t("Good to know")}</summary>
                        <ul>
                          {s.tips.map((tip, j) => (
                            <li key={j}>{tip}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </section>
                ))}
                {data.tasks.length > 0 && (
                  <section data-testid="help-tasks">
                    <h3>{t("Your tasks on this screen")}</h3>
                    {data.tasks.map((task) => (
                      <details key={task.id} data-testid="help-task">
                        <summary>
                          {task.title} <span className="muted">· {task.when}</span>
                        </summary>
                        {task.why && <p className="muted">{task.why}</p>}
                        {task.before.length > 0 && (
                          <>
                            <h4>{t("Before you start")}</h4>
                            <ul>
                              {task.before.map((b, j) => (
                                <li key={j}>{b}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        <ol>
                          {task.steps.map((s, j) => (
                            <li key={j}>
                              {s.do}
                              {s.see && <div className="muted">— {s.see}</div>}
                            </li>
                          ))}
                        </ol>
                        {task.if.length > 0 && (
                          <dl>
                            {task.if.map((w, j) => (
                              <div key={j}>
                                <dt>{w.case}</dt>
                                <dd>{w.do}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </details>
                    ))}
                  </section>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
