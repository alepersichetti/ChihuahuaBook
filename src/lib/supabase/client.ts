import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/server/adapters/supabase/database.types";
import { readConfig } from "@/server/config";

// Next inserisce nel bundle del browser solo le variabili NEXT_PUBLIC_ citate per nome.
export function createClient() {
  const config = readConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }).match(
    (valid) => valid,
    (message) => {
      throw new Error(message);
    },
  );
  return createBrowserClient<Database>(config.supabaseUrl, config.supabaseKey);
}
