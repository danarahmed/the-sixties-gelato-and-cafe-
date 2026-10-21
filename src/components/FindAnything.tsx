"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";
import { findAnythingAction } from "@/lib/actions/find";
import type { Found } from "@/lib/db/findAnything";

export interface Screen {
  href: string;
  /** In the reader's language. */
  label: string;
  /** In English too, so "stock" finds Inventory whatever the language shown. */
  english: string;
}

const KIND: Record<Found["kind"], string> = {
  product: "Product",
  item: "Stock item",
  customer: "Customer",
  supplier: "Supplier",
  staff: "Staff",
  order: "Purchase order",
  sale: "Find the sale on Orders",
  journal: "Journal",
};

/** Letters as they are looked for: small, without the marks on them. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٟ]/g, "");
}

/**
 * Find anything (E4): Ctrl+K (⌘K), or the search button on the top bar, opens
 * one box for the screens a person may open and the records they may read —
 * products, stock items, customers, suppliers, staff, purchase orders, sales
 * and journals, in any of the café's languages. Arrows choose, Enter goes.
 */
export function FindAnything({ screens }: { screens: Screen[] }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [at, setAt] = useState(0);
  const [busy, start] = useTransition();
  const box = useRef<HTMLInputElement>(null);
  const asked = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setFound([]);
      setAt(0);
      setTimeout(() => box.current?.focus(), 0);
    }
  }, [open]);

  // Records are asked for once the typing pauses; only the last answer counts.
  useEffect(() => {
    const words = q.trim();
    if (words.length < 2) {
      setFound([]);
      return;
    }
    const n = ++asked.current;
    const timer = setTimeout(() => {
      start(async () => {
        const r = await findAnythingAction(words).catch(() => []);
        if (n === asked.current) setFound(r);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const screensFound = useMemo(() => {
    const w = fold(q.trim());
    if (!w) return screens.slice(0, 8);
    return screens
      .filter((s) => fold(s.label).includes(w) || fold(s.english).includes(w))
      .slice(0, 6);
  }, [q, screens]);

  const all: { href: string; label: string; detail: string | null; kind: string }[] = [
    ...screensFound.map((s) => ({ href: s.href, label: s.label, detail: null, kind: t("Screen") })),
    ...found.map((f) => ({
      href: f.href,
      label: f.label,
      detail: f.detail,
      kind: t(KIND[f.kind]),
    })),
  ];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        className="icon-only find-button"
        onClick={() => setOpen(true)}
        aria-label={t("Find anything")}
        title={t("Find anything")}
        data-testid="find-open"
      >
        <Icon name="search" />
      </button>
      {open && (
        <div className="pos-modal-back find-back" onClick={() => setOpen(false)}>
          <div
            className="pos-modal find-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Find anything")}
            onClick={(e) => e.stopPropagation()}
            data-testid="find-dialog"
          >
            <div className="find-input">
              <Icon name="search" />
              <input
                ref={box}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setAt(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setAt((i) => Math.min(i + 1, Math.max(all.length - 1, 0)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setAt((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && all[at]) {
                    e.preventDefault();
                    go(all[at]!.href);
                  }
                }}
                placeholder={t("A screen, a product, a customer, a sale's number…")}
                aria-label={t("Find anything")}
                autoComplete="off"
                spellCheck={false}
                data-testid="find-input"
              />
              {busy && <span className="muted">…</span>}
            </div>
            <ul className="find-list" role="listbox" aria-label={t("Found")}>
              {all.map((r, i) => (
                <li
                  key={`${r.href}-${i}`}
                  role="option"
                  aria-selected={i === at}
                  className={i === at ? "on" : ""}
                  onMouseEnter={() => setAt(i)}
                  onClick={() => go(r.href)}
                  data-testid="find-row"
                  data-href={r.href}
                >
                  <span className="find-label" dir="auto">
                    {r.label}
                  </span>
                  {r.detail && (
                    <span className="muted find-detail" dir="auto">
                      {r.detail}
                    </span>
                  )}
                  <span className="find-kind">{r.kind}</span>
                </li>
              ))}
              {all.length === 0 && q.trim().length >= 2 && !busy && (
                <li className="muted find-none" data-testid="find-none">
                  {t("Nothing found for “{q}”.", { q: q.trim() })}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
