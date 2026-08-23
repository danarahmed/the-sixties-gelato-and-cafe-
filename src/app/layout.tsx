import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { AppShell } from "@/components/AppShell";
import { dirFor, LOCALES, type Locale } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "The Sixty's Gelato & Café",
  description:
    "Business-management system: POS, inventory, production, delivery platforms, accounting.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Sixty's" },
};

export const viewport: Viewport = {
  themeColor: "#b8375b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const rawLocale = store.get("locale")?.value as Locale | undefined;
  const locale: Locale = rawLocale && LOCALES.includes(rawLocale) ? rawLocale : "en";
  const theme = (store.get("theme")?.value === "dark" ? "dark" : "light") as "light" | "dark";
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} data-theme={theme}>
      <body>
        <I18nProvider locale={locale}>
          <AppShell locale={locale} theme={theme}>
            {children}
          </AppShell>
        </I18nProvider>
        <script
          // Register the service worker for offline/PWA support.
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
