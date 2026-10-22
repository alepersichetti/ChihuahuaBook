import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "../../config";
import type { Database } from "./database.types";

export type Supabase = SupabaseClient<Database>;

/**
 * Client Supabase legato a una singola richiesta HTTP standard.
 * Legge la sessione dai cookie oppure da `Authorization: Bearer <jwt>`
 * (utile per client non browser). Non scrive cookie: il refresh della
 * sessione spetta allo strato della piattaforma (es. il proxy di Next).
 */
export const supabaseForRequest = (
  config: Config,
  request: Request,
): Supabase => {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];

  return createServerClient<Database>(config.supabaseUrl, config.supabaseKey, {
    cookies: {
      getAll: () =>
        parseCookieHeader(request.headers.get("cookie") ?? "").map(
          ({ name, value }) => ({ name, value: value ?? "" }),
        ),
      setAll: () => {},
    },
    global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {},
  });
};
