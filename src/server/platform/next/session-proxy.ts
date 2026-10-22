import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readConfig } from "../../config";
import type { Database } from "../../adapters/supabase/database.types";

// Unica parte legata a Next: aggiorna il token di sessione Supabase e lo
// riscrive nei cookie di richiesta (per gli handler a valle) e di risposta.
// Su un altro runtime va sostituita con l'equivalente middleware.
export const refreshSupabaseSession = async (
  request: NextRequest,
): Promise<NextResponse> => {
  const config = readConfig(process.env);
  if (config.isErr()) return NextResponse.next({ request });
  const { supabaseUrl, supabaseKey } = config.value;

  // Il client di @supabase/ssr comunica i cookie aggiornati via callback:
  // la risposta va quindi ricostruita quando arrivano.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // Non inserire codice tra la creazione del client e getClaims().
  await supabase.auth.getClaims();

  return response;
};
