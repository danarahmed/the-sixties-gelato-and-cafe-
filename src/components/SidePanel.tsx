"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";

/**
 * A panel beside the list on a wide screen, the whole screen on a phone: one
 * person on Staff, one product on Products & Recipes, one batch recipe on
 * Production. Closed by ✕, Escape or a tap outside it; while it is open the
 * page behind it stays still.
 */
export function SidePanel({
  label,
  head,
  onClose,
  testId,
  wide = false,
  children,
}: {
  /** What the panel is called, for a screen reader. */
  label: string;
  /** What heads it, beside the ✕. */
  head: ReactNode;
  onClose: () => void;
  testId: string;
  /** Wider, for a recipe's lines. */
  wide?: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    box.current?.focus();
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = was;
    };
  }, []);

  return (
    <div className="side-panel-back" onClick={onClose}>
      <div
        ref={box}
        tabIndex={-1}
        className={wide ? "side-panel wide" : "side-panel"}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="side-panel-head">
          <div style={{ minWidth: 0, flex: 1 }}>{head}</div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t("Close")}
            data-testid={`${testId}-close`}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface PanelTab {
  id: string;
  label: string;
  /** The tab's own test id, kept from the buttons it replaced. */
  testId?: string;
  content: ReactNode;
}

/** The tabs inside a panel: one part at a time, the first shown at first. */
export function PanelTabs({
  tabs,
  label,
  initial,
}: {
  tabs: PanelTab[];
  label: string;
  initial?: string;
}) {
  const [part, setPart] = useState(tabs.find((x) => x.id === initial)?.id ?? tabs[0]?.id ?? null);
  if (tabs.length === 0) return null;
  const shown = tabs.find((x) => x.id === part) ?? tabs[0]!;
  return (
    <>
      <div className="seg panel-tabs" role="tablist" aria-label={label}>
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={shown.id === x.id}
            className={shown.id === x.id ? "active" : undefined}
            onClick={() => setPart(x.id)}
            data-testid={x.testId ?? `tab-${x.id}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={shown.label} data-part={shown.id}>
        {shown.content}
      </div>
    </>
  );
}
