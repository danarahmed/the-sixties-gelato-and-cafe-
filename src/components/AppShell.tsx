"use client";

import { use, useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/core";
import { NAV, activeHref, holdsAny } from "@/lib/auth/routes";
import { BrandMark, Icon, type IconName } from "@/components/Icon";

/** Each screen's icon in the menu, beside its name. */
const NAV_ICONS: Record<string, IconName> = {
  "/dashboard": "dashboard",
  "/sales": "sales",
  "/platforms": "platforms",
  "/customers": "customers",
  "/vendors": "vendors",
  "/expenses": "expenses",
  "/purchasing": "purchasing",
  "/payroll": "payroll",
  "/pos": "cone",
  "/start-of-day": "sun",
  "/end-of-day": "sunset",
  "/orders": "orders",
  "/products": "cup",
  "/inventory": "box",
  "/count": "count",
  "/inventory/usage": "usage",
  "/inventory/transfers": "transfers",
  "/production": "bowl",
  "/staff": "staff",
  "/journals": "book",
  "/accounting": "ledger",
  "/reports": "reports",
  "/audit": "shield",
  "/settings": "settings",
};

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

let pageLoaded: Promise<void> | null = null;

/**
 * Holds hydration back, before the menu and the page, until the whole page
 * has arrived. A page's data comes after its HTML, in scripts at its end, and
 * a long page (the audit trail's 500 changes) is still arriving when React
 * starts to hydrate. React paused at an element for a part not there yet, and
 * when it came hydrated that element again from the wrong place: a hydration
 * error (React's #418), the page thrown away and drawn again. Nothing is
 * missing once the document has loaded, so the page is hydrated once, whole.
 * The server and the browser both draw nothing here.
 */
function WholePage() {
  if (typeof document === "undefined" || document.readyState !== "loading") return null;
  pageLoaded ??= new Promise((done) =>
    document.addEventListener("DOMContentLoaded", () => setTimeout(done), { once: true }),
  );
  use(pageLoaded);
  return null;
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
  const { t, languages } = useT();
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
      <span className={`badge conn ${online ? "ok" : "err"}`}>
        {online ? t("common.online") : t("common.offlineShort")}
      </span>
      <label className="muted" style={{ fontSize: ".85rem" }}>
        <span className="sr-only">{t("common.language")}</span>
        <select
          aria-label={t("common.language")}
          value={locale}
          onChange={(e) => changeLocale(e.target.value)}
          style={{
            width: "auto",
            minHeight: 40,
            borderRadius: 8,
            padding: "0 8px",
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={toggleTheme}
        aria-label={t("common.theme")}
        title={t("common.theme")}
        className="icon-only"
      >
        <Icon name={cur === "dark" ? "moon" : "sun"} />
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
        <WholePage />
        <header className="topbar">
          <BrandMark />
          <span className="brand">{t("app.name")}</span>
          <span className="spacer" />
          <Controls locale={locale} theme={theme} />
        </header>
        <OfflineBanner />
        <main className="content" id="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    );
  }

  // Only the screens this person's roles open. The database enforces the
  // same limits on every read and write; this just keeps the menu honest.
  const nav = NAV.filter((n) => holdsAny(member.permissions, n.anyOf));
  // The till takes the whole screen; the menu opens from the ☰ button.
  const posMode = pathname === "/pos" || pathname?.startsWith("/pos/");
  const lit = activeHref(
    pathname,
    nav.map((n) => n.href),
  );

  return (
    <div className={`app-shell${posMode ? " pos-mode" : ""}`}>
      {/* The first place the keyboard reaches: past the menu, to the page (AL). */}
      <a href="#content" className="skip-link">
        {t("Skip to the content")}
      </a>
      <WholePage />
      <header className="topbar">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t("Menu")}
          aria-expanded={menuOpen}
          aria-controls="sidenav"
          style={{ minWidth: 44 }}
          className="menu-toggle icon-only"
        >
          <Icon name="menu" />
        </button>
        <BrandMark />
        <span className="brand" dir="auto">
          {member.businessName || t("app.name")}
        </span>
        <span className="spacer" />
        <Controls locale={locale} theme={theme} />
        <Link href="/account" className="badge account-badge" title={t("nav.account")}>
          <span className="account-name" dir="auto">
            {member.name}
          </span>
        </Link>
      </header>
      <OfflineBanner />
      <div className="layout">
        <nav
          id="sidenav"
          aria-label={t("Menu")}
          className={`sidenav ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(false)}
        >
          {nav.map((n, i) => {
            const active = n.href === lit;
            const heading = n.group && n.group !== nav[i - 1]?.group ? n.group : null;
            return (
              <div key={n.href}>
                {heading && <div className="navgroup">{t(heading)}</div>}
                <Link
                  href={n.href}
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                >
                  {NAV_ICONS[n.href] && <Icon name={NAV_ICONS[n.href]!} size={18} />}
                  {t(n.key)}
                </Link>
              </div>
            );
          })}
          <div>
            <div className="navgroup">{t("nav.group.you")}</div>
            <Link
              href="/account"
              className={pathname === "/account" ? "active" : ""}
              aria-current={pathname === "/account" ? "page" : undefined}
            >
              <Icon name="user" size={18} />
              {t("nav.account")}
            </Link>
          </div>
        </nav>
        <main className="content" id="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
