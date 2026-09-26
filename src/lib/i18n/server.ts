import "server-only";
/**
 * The reader's language on the server: chosen with the language switcher
 * (a cookie), one of the café's languages, else English. Read once a request.
 *
 * The café's languages are the three built in and any the owner added on
 * Settings → Languages; a language's words are the built-in ones (Arabic and
 * Kurdish; English is the phrases themselves) with the café's own words over
 * them (0032, app_words()). Signed out, or without a database, the built-in
 * ones alone.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import {
  BUILT_IN_LANGUAGES,
  dirOf,
  messenger,
  translator,
  type Language,
  type Locale,
  type Msg,
  type T,
  type Words,
} from "./core";
import { builtInWords } from "./dictionaries";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

interface CafeWords {
  languages: Language[];
  phrases: Words;
}

const NONE: CafeWords = { languages: [], phrases: {} };

/** The café's added languages in use, and its own words in one language. */
const cafeWords = cache(async (locale: string): Promise<CafeWords> => {
  if (!supabaseConfig()) return NONE;
  try {
    const db = await createServerSupabase();
    const { data, error } = await db.rpc("app_words", { p_locale: locale });
    if (error || !data) return NONE;
    const o = data as { languages?: unknown; phrases?: unknown };
    const languages = (Array.isArray(o.languages) ? o.languages : []).flatMap((l): Language[] => {
      const x = l as { code?: unknown; name?: unknown; dir?: unknown };
      return typeof x.code === "string" && typeof x.name === "string"
        ? [{ code: x.code, label: x.name, dir: x.dir === "rtl" ? "rtl" : "ltr", builtIn: false }]
        : [];
    });
    const phrases: Words = {};
    if (o.phrases && typeof o.phrases === "object")
      for (const [k, v] of Object.entries(o.phrases as Record<string, unknown>))
        if (typeof v === "string") phrases[k] = v;
    return { languages, phrases };
  } catch {
    // The words are a courtesy: a page is never refused for want of them.
    return NONE;
  }
});

/** The language the switcher's cookie asks for, as it is. */
const asked = cache(async (): Promise<string> => (await cookies()).get("locale")?.value ?? "en");

/** The café's languages: the built-in three, then any the owner added. */
export const getLanguages = cache(async (): Promise<Language[]> => [
  ...BUILT_IN_LANGUAGES,
  ...(await cafeWords(await asked())).languages,
]);

export const getLocale = cache(async (): Promise<Locale> => {
  const raw = await asked();
  const languages = await getLanguages();
  return languages.some((l) => l.code === raw) ? raw : "en";
});

/** The reader's direction: right to left for Arabic and Kurdish. */
export async function getDir(): Promise<"ltr" | "rtl"> {
  return dirOf(await getLanguages(), await getLocale());
}

/** Every word of the reader's language: the built-in ones, then the café's own. */
export const getWords = cache(async (): Promise<Words> => {
  const locale = await getLocale();
  const own = (await cafeWords(locale)).phrases;
  return { ...builtInWords(locale), ...own };
});

/** The translator for the reader's language. */
export async function getT(): Promise<T> {
  return translator(await getWords());
}

/** The translator for messages (the database's, an alert's), in the reader's language. */
export async function getMsg(): Promise<Msg> {
  return messenger(await getWords());
}
