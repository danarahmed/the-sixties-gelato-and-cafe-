"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { reportProblemAction } from "@/lib/actions/problems";
import { useT } from "@/lib/i18n/I18nProvider";
import { Modal } from "@/components/pos/Dialogs";
import { Icon } from "@/components/Icon";

/** The last error the page saw, kept with a report so it can be put right without asking. */
let lastError: string | null = null;

/**
 * "Something's wrong?" (G5, 0083), in the menu on every screen: whoever is
 * signed in says in a word or two what went wrong; the screen, the
 * connection and the last error the page saw go with it. The owner and the
 * managers see the list on Reported problems.
 */
export function ProblemButton() {
  const { t, msg } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, start] = useTransition();
  const key = useRef<string | null>(null);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      lastError = String(e.message || e.error || "error").slice(0, 300);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      lastError = String(e.reason?.message ?? e.reason ?? "rejection").slice(0, 300);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  function send() {
    setError(null);
    // One report, whatever the connection does: the same key until it is sent.
    key.current ??= crypto.randomUUID();
    const page = `${window.location.pathname}${window.location.search}`.slice(0, 200);
    start(async () => {
      const r = await reportProblemAction(
        {
          page,
          what,
          context: {
            online: navigator.onLine,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            language: document.documentElement.lang || null,
            browser: navigator.userAgent.slice(0, 160),
            lastError,
            at: new Date().toISOString(),
          },
        },
        key.current!,
      ).catch(() => ({ ok: false as const, error: "No answer: try again in a moment." }));
      if (!r.ok) return setError(r.error);
      key.current = null;
      setWhat("");
      setSent(true);
    });
  }

  return (
    <>
      <button
        type="button"
        className="nav-tour"
        onClick={() => {
          setSent(false);
          setError(null);
          setOpen(true);
        }}
        data-testid="problem-button"
      >
        <Icon name="alert" size={18} />
        {t("Something's wrong?")}
      </button>
      {/* Over the page, not in the menu: the menu slides away as it is tapped. */}
      {open &&
        createPortal(
          <Modal label={t("Something's wrong?")} busy={busy} onClose={() => setOpen(false)}>
            <div className="grid" style={{ gap: 10 }} data-testid="problem-dialog">
              <h3 style={{ margin: 0 }}>
                <Icon name="alert" /> {t("Something's wrong?")}
              </h3>
              {sent ? (
                <p role="status" style={{ margin: 0 }} data-testid="problem-sent">
                  {t("Thank you. The owner will see it, with this screen.")}
                </p>
              ) : (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    {t(
                      "Say in a word or two what went wrong. The screen you are on goes with it, so nobody has to ask.",
                    )}
                  </p>
                  <textarea
                    value={what}
                    rows={3}
                    maxLength={500}
                    autoFocus
                    aria-label={t("What went wrong?")}
                    placeholder={t("The receipt printed twice")}
                    onChange={(e) => setWhat(e.target.value)}
                    data-testid="problem-what"
                  />
                  <span className="muted" style={{ fontSize: ".8rem" }}>
                    {t("On: {page}", { page: pathname ?? "/" })}
                  </span>
                </>
              )}
              {error && (
                <p className="red" role="alert" style={{ margin: 0 }}>
                  {msg(error)}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setOpen(false)} disabled={busy}>
                  {t("Close")}
                </button>
                {!sent && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || what.trim().length < 2}
                    onClick={send}
                    data-testid="problem-send"
                  >
                    {busy ? "…" : t("Send")}
                  </button>
                )}
              </div>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
