import "server-only";
import { createServerClient } from "@supabase/ssr";
import { ResultAsync } from "neverthrow";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Supabase } from "@/server/adapters/supabase/client";
import type { Database } from "@/server/adapters/supabase/database.types";
import { readConfig } from "@/server/config";

// Client Supabase per Server Component e Route Handler di Next.
// Nei Server Component i cookie non si possono scrivere: il refresh lo fa il proxy.
// La configurazione mancante è un errore come valore, non un'eccezione.
// connection() prima dei cookie: supabase-js legge l'ora (Date.now) per la scadenza
// della sessione, e con cacheComponents Next lo segnala se accade mentre prerenderizza
// (anche nel prefetch con i soli cookie). Ogni dato Supabase è comunque per richiesta.
const requestCookies = async () => {
  await connection();
  return cookies();
};

export const createClient = (): ResultAsync<Supabase, string> =>
  readConfig(process.env).asyncAndThen((config) =>
    ResultAsync.fromSafePromise(requestCookies()).map((store) =>
      createServerClient<Database>(config.supabaseUrl, config.supabaseKey, {
        cookies: {
          getAll: () => store.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
            } catch {
              // Server Component: ignorato, ci pensa il proxy.
            }
          },
        },
      }),
    ),
  );
