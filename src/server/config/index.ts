import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

export type Config = {
  readonly supabaseUrl: string;
  readonly supabaseKey: string;
  /** Di fatto necessaria: senza, Google Books risponde con una quota giornaliera pari a zero. */
  readonly googleBooksApiKey?: string;
  /** Indirizzi alternativi dei cataloghi online: li usano i test e2e per puntare a un finto server. */
  readonly googleBooksUrl?: string;
  readonly openLibraryUrl?: string;
};

// L'integrazione Vercel–Supabase imposta NEXT_PUBLIC_SUPABASE_ANON_KEY;
// i progetti più recenti usano la publishable key. Accettiamo entrambe,
// con o senza prefisso NEXT_PUBLIC_, per poter girare anche fuori da Next.
const schema = z.object({
  supabaseUrl: z.url(),
  supabaseKey: z.string().min(1),
  googleBooksApiKey: z.string().min(1).optional(),
  googleBooksUrl: z.url().optional(),
  openLibraryUrl: z.url().optional(),
});

type Env = Readonly<Record<string, string | undefined>>;

// Gli indirizzi relativi si risolvono rispetto alla radice: senza "/" finale l'ultimo pezzo si perde.
const asRoot = (url: string | undefined) => (url && !url.endsWith("/") ? `${url}/` : url);

const first = (env: Env, names: readonly string[]) =>
  names.map((name) => env[name]).find((value) => value);

export const readConfig = (env: Env): Result<Config, string> => {
  const parsed = schema.safeParse({
    supabaseUrl: first(env, ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    supabaseKey: first(env, [
      "SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]),
    // Incollata nel pannello di Vercel, la chiave si porta dietro spazi o a capo.
    googleBooksApiKey: first(env, ["GOOGLE_BOOKS_API_KEY"])?.trim() || undefined,
    googleBooksUrl: asRoot(first(env, ["GOOGLE_BOOKS_API_URL"])),
    openLibraryUrl: asRoot(first(env, ["OPEN_LIBRARY_URL"])),
  });
  return parsed.success
    ? ok(parsed.data)
    : err(
        "Configurazione Supabase mancante: imposta SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (anche con prefisso NEXT_PUBLIC_).",
      );
};
