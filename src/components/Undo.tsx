"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

const SECONDS = 10;

/**
 * Undo for a few seconds (E7), after a save where nothing is in the books: a
 * product's details, the week's schedule, a table. The undo saves what was
 * there before, the same way; sales, payments and anything posted keep their
 * own way to put right (void, refund, reverse).
 */
export function useUndo(): {
  offer: (text: string, undo: () => Promise<{ ok: boolean; error?: string }>) => void;
  node: ReactNode;
} {
  const { t, msg: say } = useT();
  const [shown, setShown] = useState<{
    text: string;
    undo: () => Promise<{ ok: boolean; error?: string }>;
  } | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const offer = useCallback(
    (text: string, undo: () => Promise<{ ok: boolean; error?: string }>) => {
      stop();
      setShown({ text, undo });
      setLeft(SECONDS);
      setState("idle");
      timer.current = setInterval(() => {
        setLeft((n) => {
          if (n <= 1) {
            stop();
            setShown(null);
            return 0;
          }
          return n - 1;
        });
      }, 1000);
    },
    [stop],
  );

  async function run() {
    if (!shown) return;
    stop();
    setState("busy");
    const r = await shown.undo();
    setState(r.ok ? "done" : (r.error ?? "error"));
    if (r.ok) setTimeout(() => setShown(null), 2500);
  }

  const node = shown ? (
    <div className="undo-bar badge ok" role="status" data-testid="undo-bar">
      <span>{shown.text}</span>
      {state === "idle" && (
        <button type="button" className="undo-button" onClick={() => void run()} data-testid="undo">
          {t("Undo ({n})", { n: left })}
        </button>
      )}
      {state === "busy" && <span>…</span>}
      {state === "done" && <span data-testid="undone">{t("Undone: as it was before.")}</span>}
      {state !== "idle" && state !== "busy" && state !== "done" && (
        <span className="err">{say(state)}</span>
      )}
    </div>
  ) : null;

  return { offer, node };
}
