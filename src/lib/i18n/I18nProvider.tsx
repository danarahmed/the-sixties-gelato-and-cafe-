"use client";
/**
 * The reader's language for the screens in the browser: its code, direction,
 * the café's languages for the switcher, and the translator. The server gives
 * it this language's words only (see core.ts).
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  BUILT_IN_LANGUAGES,
  fill,
  messenger,
  translator,
  type Dir,
  type Language,
  type Locale,
  type Msg,
  type T,
  type Words,
} from "./core";

interface I18nContextValue {
  locale: Locale;
  dir: Dir;
  languages: Language[];
  t: T;
  /** A message from the server or the database (an error, an alert), translated. */
  msg: Msg;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  dir: "ltr",
  languages: BUILT_IN_LANGUAGES,
  t: (key, vars) => fill(key, vars),
  msg: (text) => text,
});

export function I18nProvider({
  locale,
  dir,
  languages,
  words,
  children,
}: {
  locale: Locale;
  dir: Dir;
  languages: Language[];
  words: Words;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, dir, languages, t: translator(words), msg: messenger(words) }),
    [locale, dir, languages, words],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  return useContext(I18nContext);
}
