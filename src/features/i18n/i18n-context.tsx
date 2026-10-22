"use client";

import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { locales, type Language } from "./languages";
import { messages, type Messages } from "./messages";

const useI18nValue = (initial: Language) => {
  // Parte dal valore del server; cambia solo quando l'amministratore la sceglie nelle impostazioni.
  const [language, setLanguage] = useState(initial);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return useMemo(
    () => ({ language, setLanguage, t: messages[language], locale: locales[language] }),
    [language],
  );
};

type I18nValue = ReturnType<typeof useI18nValue>;

const I18nContext = createContext<I18nValue | null>(null);

/** Lingua dell'interfaccia, decisa per tutta l'istanza dall'amministratore. */
export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <I18nContext value={useI18nValue(language)}>{children}</I18nContext>;
}

export const useI18n = () => {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n va usato dentro I18nProvider");
  return value;
};

/** Scorciatoia per i testi: `const t = useT(); t.common.cancel`. */
export const useT = (): Messages => useI18n().t;
