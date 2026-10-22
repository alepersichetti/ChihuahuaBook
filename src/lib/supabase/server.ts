import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/server/adapters/supabase/database.types";
import { readConfig } from "@/server/config";

// Client Supabase per Server Component e Route Handler di Next.
// Nei Server Component i cookie non si possono scrivere: il refresh lo fa il proxy.
export async function createClient() {
  const config = readConfig(process.env).match(
    (valid) => valid,
    (message) => {
      throw new Error(message);
    },
  );
  const store = await cookies();
  return createServerClient<Database>(config.supabaseUrl, config.supabaseKey, {
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
  });
}
