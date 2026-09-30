"use client";

import { useCallback, useRef, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

/**
 * Submissions recorded once, whatever the connection does (0035, release J).
 *
 * The person submits: a key is made for that submission and sent with it. If no
 * answer comes back, the write may or may not have happened, so it is sent
 * again, by itself, with the SAME key: the database recognises the key and
 * answers with what it did the first time instead of doing it twice. After
 * three tries with no answer it stops and says so; pressing the same button
 * again sends it once more, still with that key. A definite answer — done, or
 * refused — ends the submission, and the next one gets a new key.
 *
 * Each kind of submission on a screen has its own name, so a delivery that is
 * still unanswered never lends its key to a payment made next to it.
 */

type Result = { ok: true } | { ok: false; error: string; uncertain?: boolean };

/** Waits between the automatic tries, in milliseconds. */
const RETRY_WAITS = [1000, 2000, 4000];

export const CHECKING_MESSAGE = "Your previous submission may already have been saved. Checking…";
export const STUCK_MESSAGE =
  "Still no answer. It may have been saved: press the same button again to check. It will not be recorded twice.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Operation {
  /** True while a submission with no answer is being sent again. */
  checking: boolean;
  /**
   * Send one submission named `name`; `send` receives the key to pass to the
   * server action. While an earlier submission of that name is unanswered, its
   * key is used again.
   */
  run<R extends Result>(name: string, send: (key: string) => Promise<R>): Promise<R>;
}

export function useOperation(): Operation {
  const [checking, setChecking] = useState(0);
  const waiting = useRef(new Map<string, string>());

  const run = useCallback(
    async <R extends Result>(name: string, send: (key: string) => Promise<R>): Promise<R> => {
      const key = waiting.current.get(name) ?? crypto.randomUUID();
      let r = await attempt(send, key);
      if (unanswered(r)) {
        setChecking((n) => n + 1);
        try {
          for (const wait of RETRY_WAITS) {
            await sleep(wait);
            r = await attempt(send, key);
            if (!unanswered(r)) break;
          }
        } finally {
          setChecking((n) => n - 1);
        }
      }
      if (unanswered(r)) {
        waiting.current.set(name, key);
        return { ...r, error: STUCK_MESSAGE } as R;
      }
      waiting.current.delete(name);
      return r;
    },
    [],
  );

  return { checking: checking > 0, run };
}

function unanswered(r: Result): boolean {
  return !r.ok && r.uncertain === true;
}

async function attempt<R extends Result>(
  send: (key: string) => Promise<R>,
  key: string,
): Promise<R> {
  try {
    return await send(key);
  } catch {
    // The request to the app's server itself failed: no answer at all.
    return { ok: false, uncertain: true, error: STUCK_MESSAGE } as R;
  }
}

/** What a form shows while a submission with no answer is sent again. */
export function OperationStatus({ op }: { op: Operation }) {
  const { t } = useT();
  if (!op.checking) return null;
  return (
    <div
      className="badge warn"
      role="status"
      aria-live="polite"
      style={{ alignSelf: "start", whiteSpace: "normal" }}
    >
      ⏳ {t(CHECKING_MESSAGE)}
    </div>
  );
}
