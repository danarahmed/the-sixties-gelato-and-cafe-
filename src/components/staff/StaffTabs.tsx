"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface StaffTab {
  /** The section's own anchor (#people, #schedule…): links from other screens open its tab. */
  id: string;
  label: string;
  content: ReactNode;
  /** Other anchors inside it that open it too (#add-person). */
  also?: string[];
}

/**
 * The Staff screen in tabs (the owner's choice): People, the schedule, the
 * hours and the shop's clock, one at a time. Each tab is its section's anchor,
 * so /staff#schedule and every link already made to a section still opens it;
 * every tab stays on the page, hidden, so what is typed in one is kept while
 * another is looked at.
 */
export function StaffTabs({ tabs, label }: { tabs: StaffTab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      const tab = tabs.find((x) => x.id === h || x.also?.includes(h));
      if (tab) setActive(tab.id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // The tabs are the page's own; their anchors do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(id: string, focus = false) {
    setActive(id);
    // The address says which tab, so a reload or a shared link opens it.
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${search}#${id}`);
    if (focus) buttons.current[id]?.focus();
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    const rtl = document.documentElement.dir === "rtl";
    const step =
      e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : step ? i + step : null;
    if (to === null) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length];
    if (next) choose(next.id, true);
  }

  return (
    <div className="grid staff-tabs" style={{ gap: 16 }}>
      <div className="seg staff-tab-bar" role="tablist" aria-label={label}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              buttons.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            className={active === tab.id ? "active" : undefined}
            onClick={() => choose(tab.id)}
            onKeyDown={(e) => onKey(e, i)}
            data-testid={`staff-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={active !== tab.id}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
