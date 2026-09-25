import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { AppShell, type ShellMember } from "@/components/AppShell";
import { getDir, getLanguages, getLocale, getWords } from "@/lib/i18n/server";
import { getSession } from "@/lib/auth/session";

// The café's name, the same in every language. i18n-ignore
export const metadata: Metadata = {
  title: "The Sixty's Gelato & Café", // i18n-ignore
  description:
    "Business-management system: POS, inventory, production, delivery platforms, accounting.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Sixty's" }, // i18n-ignore
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#b8375b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** The member for the shell, or null (signed out, not linked, or unreadable —
 * in the last case the page itself reports the error). */
async function shellMember(): Promise<ShellMember | null> {
  try {
    const s = await getSession();
    if (!s.profile) return null;
    return {
      name: s.profile.name,
      businessName: s.profile.businessName,
      permissions: s.profile.permissions,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const theme = (store.get("theme")?.value === "dark" ? "dark" : "light") as "light" | "dark";
  const [locale, dir, languages, words, member] = await Promise.all([
    getLocale(),
    getDir(),
    getLanguages(),
    getWords(),
    shellMember(),
  ]);

  return (
    <html lang={locale} dir={dir} data-theme={theme}>
      <body>
        <I18nProvider locale={locale} dir={dir} languages={languages} words={words}>
          <AppShell locale={locale} theme={theme} member={member}>
            {children}
          </AppShell>
        </I18nProvider>
        <script
          // The service worker caches only the app's static files and an
          // offline notice — never a page with business data on it.
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
