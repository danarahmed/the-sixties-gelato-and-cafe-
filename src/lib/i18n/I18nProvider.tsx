"use client";

import { createContext, useContext, type ReactNode } from "react";
import { translate, type Locale } from "./dictionaries";

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({ locale: "en", t: (k) => k });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value: I18nContextValue = { locale, t: (key) => translate(locale, key) };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  return useContext(I18nContext);
}
