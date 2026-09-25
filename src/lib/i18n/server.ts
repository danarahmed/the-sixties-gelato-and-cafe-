import "server-only";
/**
 * The reader's language on the server: chosen with the language switcher
 * (a cookie), one of the café's languages, else English. Read once a request.
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

/** The café's languages: the built-in three, then any the owner added. */
export const getLanguages = cache(async (): Promise<Language[]> => BUILT_IN_LANGUAGES);

export const getLocale = cache(async (): Promise<Locale> => {
  const raw = (await cookies()).get("locale")?.value;
  const languages = await getLanguages();
  return raw && languages.some((l) => l.code === raw) ? raw : "en";
});

/** The reader's direction: right to left for Arabic and Kurdish. */
export async function getDir(): Promise<"ltr" | "rtl"> {
  return dirOf(await getLanguages(), await getLocale());
}

/** Every word of the reader's language. */
export const getWords = cache(async (): Promise<Words> => builtInWords(await getLocale()));

/** The translator for the reader's language. */
export async function getT(): Promise<T> {
  return translator(await getWords());
}

/** The translator for messages (the database's, an alert's), in the reader's language. */
export async function getMsg(): Promise<Msg> {
  return messenger(await getWords());
}
