import { cookies } from "next/headers";
import { LOCALES, translate, type Locale } from "./dictionaries";

/** Resolve the active locale from the cookie for server components. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get("locale")?.value as Locale | undefined;
  return raw && LOCALES.includes(raw) ? raw : "en";
}

/** Server-side translator bound to the active locale. */
export async function getT(): Promise<(key: string) => string> {
  const locale = await getLocale();
  return (key: string) => translate(locale, key);
}
