import "server-only";
import { createServerClient } from "@supabase/ssr";
import { ResultAsync } from "neverthrow";
import { cookies } from "next/headers";
import type { Supabase } from "@/server/adapters/supabase/client";
import type { Database } from "@/server/adapters/supabase/database.types";
import { readConfig } from "@/server/config";

// Client Supabase per Server Component e Route Handler di Next.
// Nei Server Component i cookie non si possono scrivere: il refresh lo fa il proxy.
// La configurazione mancante è un errore come valore, non un'eccezione.
export const createClient = (): ResultAsync<Supabase, string> =>
  readConfig(process.env).asyncAndThen((config) =>
    ResultAsync.fromSafePromise(cookies()).map((store) =>
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
