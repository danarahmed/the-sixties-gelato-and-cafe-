"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/dictionaries";
import { NAV, holdsAny } from "@/lib/auth/routes";

export interface ShellMember {
  name: string;
  businessName: string;
  permissions: string[];
}

/** Whether the browser is online, kept current. */
export function useOnline(): boolean {
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
  return online;
}

/**
 * The connection state, stated honestly: nothing is queued while offline, so
 * the banner says a sale cannot be recorded until the connection returns
 * (audit H-04 — the old banner promised a queue that did not exist).
 */
function OfflineBanner() {
  const { t } = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="alert">
      {t("common.offline")}
    </div>
  );
}

function Controls({ locale, theme }: { locale: Locale; theme: "light" | "dark" }) {
  const { t } = useT();
  const [cur, setCur] = useState(theme);
  const online = useOnline();

  function changeLocale(next: string) {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }
  function toggleTheme() {
    const next = cur === "dark" ? "light" : "dark";
    setCur(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span className={`badge ${online ? "ok" : "err"}`}>
        {online ? t("common.online") : t("common.offlineShort")}
      </span>
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
  member,
  children,
}: {
  locale: Locale;
  theme: "light" | "dark";
  member: ShellMember | null;
  children: ReactNode;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Signed out (sign-in, setup): no navigation, nothing about the business.
  if (!member) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <span className="brand">{t("app.name")}</span>
          <span className="spacer" />
          <Controls locale={locale} theme={theme} />
        </header>
        <OfflineBanner />
        <main className="content">{children}</main>
      </div>
    );
  }

  // Only the screens this person's roles open. The database enforces the
  // same limits on every read and write; this just keeps the menu honest.
  const nav = NAV.filter((n) => holdsAny(member.permissions, n.anyOf));
  // The till takes the whole screen; the menu opens from the ☰ button.
  const posMode = pathname === "/pos" || pathname?.startsWith("/pos/");

  return (
    <div className={`app-shell${posMode ? " pos-mode" : ""}`}>
      <header className="topbar">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          style={{ minWidth: 44 }}
          className="menu-toggle"
        >
          ☰
        </button>
        <span className="brand">{member.businessName || t("app.name")}</span>
        <span className="spacer" />
        <Controls locale={locale} theme={theme} />
        <Link href="/account" className="badge" title={t("nav.account")}>
          {member.name}
        </Link>
      </header>
      <OfflineBanner />
      <div className="layout">
        <nav className={`sidenav ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}>
          {nav.map((n, i) => {
            const active = pathname === n.href || pathname?.startsWith(`${n.href}/`);
            const heading = n.group && n.group !== nav[i - 1]?.group ? n.group : null;
            return (
              <div key={n.href}>
                {heading && <div className="navgroup">{t(heading)}</div>}
                <Link href={n.href} className={active ? "active" : ""}>
                  {t(n.key)}
                </Link>
              </div>
            );
          })}
          <div>
            <div className="navgroup">{t("nav.group.you")}</div>
            <Link href="/account" className={pathname === "/account" ? "active" : ""}>
              {t("nav.account")}
            </Link>
          </div>
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
