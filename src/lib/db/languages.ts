import "server-only";
/**
 * The café's languages and its own words (0032), for Settings → Languages.
 * Every page reads them through src/lib/i18n/server.ts instead.
 */
import { db, one, str } from "./client";

export interface AddedLanguage {
  code: string;
  name: string;
  dir: "ltr" | "rtl";
  isActive: boolean;
}

export interface LanguageSettings {
  languages: AddedLanguage[];
  /** How many phrases have the café's own words, by language. */
  ownWords: Record<string, number>;
}

export async function getLanguageSettings(): Promise<LanguageSettings> {
  const c = await db();
  const o = one<{ languages?: unknown; own_words?: unknown }>(
    await c.rpc("language_settings"),
    "the languages",
  );
  const languages = (Array.isArray(o?.languages) ? o.languages : []).map(
    (l: Record<string, unknown>) => ({
      code: str(l.code),
      name: str(l.name),
      dir: l.dir === "rtl" ? ("rtl" as const) : ("ltr" as const),
      isActive: l.is_active !== false,
    }),
  );
  const ownWords: Record<string, number> = {};
  if (o?.own_words && typeof o.own_words === "object")
    for (const [k, v] of Object.entries(o.own_words as Record<string, unknown>))
      ownWords[k] = Number(v) || 0;
  return { languages, ownWords };
}

/** The café's own words in one language (a built-in one, or one in use). */
export async function getOwnWords(locale: string): Promise<Record<string, string>> {
  const c = await db();
  const o = one<{ phrases?: unknown }>(
    await c.rpc("app_words", { p_locale: locale }),
    "the café's words",
  );
  const words: Record<string, string> = {};
  if (o?.phrases && typeof o.phrases === "object")
    for (const [k, v] of Object.entries(o.phrases as Record<string, unknown>))
      if (typeof v === "string") words[k] = v;
  return words;
}
