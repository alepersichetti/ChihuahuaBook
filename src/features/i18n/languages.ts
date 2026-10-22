import { instanceLanguages, type InstanceLanguage } from "@/server/core/members/members";

export const languages = instanceLanguages;
export type Language = InstanceLanguage;

export const defaultLanguage: Language = "it";

export const isLanguage = (value: unknown): value is Language =>
  languages.includes(value as Language);

/** Locale per date e numeri. */
export const locales: Readonly<Record<Language, string>> = { it: "it-IT", en: "en-GB" };

/** Il nome di ogni lingua scritto in quella lingua, come nei selettori di lingua. */
export const languageNames: Readonly<Record<Language, string>> = { it: "Italiano", en: "English" };
