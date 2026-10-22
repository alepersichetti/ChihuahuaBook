import { createBrowserClient } from "@supabase/ssr";
import type { Result } from "neverthrow";
import type { Supabase } from "@/server/adapters/supabase/client";
import type { Database } from "@/server/adapters/supabase/database.types";
import { readConfig } from "@/server/config";

// Client Supabase per il browser. Next inserisce nel bundle solo le variabili NEXT_PUBLIC_ citate per nome.
// La configurazione mancante è un errore come valore, non un'eccezione.
export const createClient = (): Result<Supabase, string> =>
  readConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }).map((config) => createBrowserClient<Database>(config.supabaseUrl, config.supabaseKey));
