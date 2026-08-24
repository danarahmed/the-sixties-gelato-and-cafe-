"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/dictionaries";

/**
 * Books-first information architecture: the ledger groups come first (what a
 * bookkeeper opens daily), operations below, then the accountant's tools.
 */
const NAV: { group?: string; href: string; key: string }[] = [
  { href: "/dashboard", key: "nav.dashboard" },

  { group: "nav.group.revenue", href: "/sales", key: "nav.sales" },
  { href: "/platforms", key: "nav.platforms" },

  { group: "nav.group.spending", href: "/vendors", key: "nav.vendors" },
  { href: "/expenses", key: "nav.expenses" },
  { href: "/purchasing", key: "nav.purchasing" },

  { group: "nav.group.operations", href: "/pos", key: "nav.pos" },
  { href: "/orders", key: "nav.orders" },
  { href: "/products", key: "nav.products" },
  { href: "/inventory", key: "nav.inventory" },
  { href: "/count", key: "nav.count" },
  { href: "/production", key: "nav.production" },

  { group: "nav.group.books", href: "/journals", key: "nav.journals" },
  { href: "/accounting", key: "nav.chart" },
  { href: "/reports", key: "nav.reports" },
  { href: "/settings", key: "nav.settings" },
];

function OnlineBadge() {
  const { t } = useT();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <span
      className={`badge ${online ? "ok" : "warn"}`}
      title={online ? t("common.online") : t("common.offline")}
    >
      {online ? t("common.online") : t("common.offline")}
    </span>
  );
}

function Controls({ locale, theme }: { locale: Locale; theme: "light" | "dark" }) {
  const { t } = useT();
  const [cur, setCur] = useState(theme);

  function changeLocale(next: string) {
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    window.location.reload();
  }
  function toggleTheme() {
    const next = cur === "dark" ? "light" : "dark";
    setCur(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000`;
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <OnlineBadge />
      <label className="muted" style={{ fontSize: ".85rem" }}>
        <span style={{ position: "absolute", left: -9999 }}>{t("common.language")}</span>
        <select
          aria-label={t("common.language")}
          value={locale}
          onChange={(e) => changeLocale(e.target.value)}
          style={{
            minHeight: 40,
            borderRadius: 8,
            padding: "0 8px",
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_META[l].label}
            </option>
          ))}
        </select>
      </label>
      <button onClick={toggleTheme} aria-label={t("common.theme")} title={t("common.theme")}>
        {cur === "dark" ? "🌙" : "☀️"}
      </button>
    </div>
  );
}

export function AppShell({
  locale,
  theme,
  children,
}: {
  locale: Locale;
  theme: "light" | "dark";
  children: ReactNode;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          style={{ minWidth: 44 }}
          className="menu-toggle"
        >
          ☰
        </button>
        <span className="brand">{t("app.name")}</span>
        <span className="spacer" />
        <Controls locale={locale} theme={theme} />
      </header>
      <div className="layout">
        <nav className={`sidenav ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}>
          {NAV.map((n) => {
            const active =
              pathname === n.href || (n.href !== "/dashboard" && pathname?.startsWith(n.href));
            return (
              <div key={n.href}>
                {n.group && <div className="navgroup">{t(n.group)}</div>}
                <Link href={n.href} className={active ? "active" : ""}>
                  {t(n.key)}
                </Link>
              </div>
            );
          })}
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
