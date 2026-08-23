"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/dictionaries";

const NAV: { href: string; key: string; icon: string }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: "📊" },
  { href: "/pos", key: "nav.pos", icon: "🧾" },
  { href: "/orders", key: "nav.orders", icon: "📋" },
  { href: "/products", key: "nav.products", icon: "🍨" },
  { href: "/production", key: "nav.production", icon: "🏭" },
  { href: "/inventory", key: "nav.inventory", icon: "📦" },
  { href: "/count", key: "nav.count", icon: "🔢" },
  { href: "/purchasing", key: "nav.purchasing", icon: "🚚" },
  { href: "/platforms", key: "nav.platforms", icon: "🛵" },
  { href: "/accounting", key: "nav.accounting", icon: "📒" },
  { href: "/reports", key: "nav.reports", icon: "📈" },
  { href: "/ai", key: "nav.ai", icon: "✨" },
  { href: "/settings", key: "nav.settings", icon: "⚙️" },
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
      {online ? "🟢" : "🟠"} {online ? t("common.online") : t("common.offline")}
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
        <span className="brand">🍨 {t("app.name")}</span>
        <span className="spacer" />
        <Controls locale={locale} theme={theme} />
      </header>
      <div className="layout">
        <nav className={`sidenav ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}>
          {NAV.map((n) => {
            const active =
              pathname === n.href || (n.href !== "/dashboard" && pathname?.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={active ? "active" : ""}>
                <span aria-hidden>{n.icon}</span>
                <span>{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
