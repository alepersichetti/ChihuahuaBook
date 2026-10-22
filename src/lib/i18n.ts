import "server-only";
import { ResultAsync } from "neverthrow";
import { defaultLanguage, isLanguage, type Language } from "@/features/i18n/languages";
import { createClient } from "@/lib/supabase/server";

/**
 * Lingua scelta dall'amministratore; leggibile anche prima del login.
 * Senza Supabase vale DEMO_LANGUAGE (solo per lo sviluppo) o l'italiano.
 */
export const getLanguage = (): Promise<Language> => {
  const demo = process.env.DEMO_LANGUAGE;
  const fallback = isLanguage(demo) ? demo : defaultLanguage;
  return createClient()
    .andThen((supabase) => ResultAsync.fromSafePromise(Promise.resolve(supabase.rpc("instance_language"))))
    .map(({ data }) => (isLanguage(data) ? data : defaultLanguage))
    .unwrapOr(fallback);
};
