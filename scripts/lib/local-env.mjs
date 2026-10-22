// Funzioni pure usate da scripts/dev.mjs: niente I/O, solo dati in ingresso e in uscita.

// Servizi di Supabase che l'app non usa: saltarli dimezza i download e l'avvio.
export const UNUSED_SERVICES = ["edge-runtime", "logflare", "vector", "imgproxy"];

export const APP_URL = "http://127.0.0.1:3000";

// `supabase status -o json` → le variabili che servono all'app, o un errore come valore.
export const supabaseEnv = (statusJson) => {
  const status = safeParse(statusJson);
  const url = status?.API_URL;
  const key = status?.PUBLISHABLE_KEY || status?.ANON_KEY;
  return url && key
    ? { ok: true, value: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } }
    : { ok: false, error: "supabase status non riporta API_URL e la chiave pubblica." };
};

// Il riepilogo stampato all'avvio.
export const localUrls = (statusJson) => {
  const status = safeParse(statusJson) ?? {};
  return [
    ["App", APP_URL],
    ["Studio", status.STUDIO_URL],
    ["Mailpit", status.MAILPIT_URL || status.INBUCKET_URL],
    ["Postgres", status.DB_URL],
  ].filter(([, url]) => url);
};

// Contenuto di un .env.local nuovo per lo stack locale.
export const envFile = (env) =>
  [
    "# Creato da `npm run dev:all` per il Supabase locale. Puoi modificarlo.",
    ...Object.entries(env).map(([name, value]) => `${name}=${value}`),
    "",
    "# Facoltativa: chiave della Books API di Google per la ricerca su Google Books.",
    "GOOGLE_BOOKS_API_KEY=",
    "",
  ].join("\n");

// Argomenti per `next dev`: di default su 127.0.0.1, come i link delle email di Supabase.
export const nextDevArgs = (extra) =>
  ["dev", ...(hasHostname(extra) ? [] : ["--hostname", "127.0.0.1"]), ...extra];

const hasHostname = (args) => args.some((arg) => arg === "-H" || arg.startsWith("--hostname"));

const safeParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
