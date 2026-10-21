"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A group of Settings, folded under its heading, which says what is turned
 * on inside it (the simplification round). It opens with a tap, and by
 * itself when the page is opened at it or at one of its parts
 * (/settings#receipt), scrolling there.
 */
export function SettingsGroup({
  id,
  title,
  status,
  children,
}: {
  id: string;
  title: string;
  /** What is turned on inside, in a few words each. */
  status: string[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const openAt = () => {
      const at = decodeURIComponent(window.location.hash.slice(1));
      const el = ref.current;
      if (!at || !el) return;
      if (at !== id && !el.querySelector(`#${CSS.escape(at)}`)) return;
      el.open = true;
      requestAnimationFrame(() => document.getElementById(at)?.scrollIntoView({ block: "start" }));
    };
    openAt();
    window.addEventListener("hashchange", openAt);
    return () => window.removeEventListener("hashchange", openAt);
  }, [id]);

  return (
    <details ref={ref} id={id} className="card settings-group" data-testid={`group-${id}`}>
      <summary>
        <span className="sg-title">{title}</span>
        {status.length > 0 && <span className="sg-status">{status.join(" · ")}</span>}
      </summary>
      <div className="sg-body">{children}</div>
    </details>
  );
}
