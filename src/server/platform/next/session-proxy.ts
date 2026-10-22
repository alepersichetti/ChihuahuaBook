import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readConfig } from "../../config";
import type { Database } from "../../adapters/supabase/database.types";
import { appUrl } from "../../http/origin";
import { isPublicPath, loginUrl } from "./access";

// Unica parte legata a Next: aggiorna il token di sessione Supabase e lo
// riscrive nei cookie di richiesta (per gli handler a valle) e di risposta.
// Su un altro runtime va sostituita con l'equivalente middleware.
export const refreshSupabaseSession = async (
  request: NextRequest,
): Promise<NextResponse> => {
  const config = readConfig(process.env);
  // Senza configurazione non c'è login possibile: meglio fermarsi che aprire tutto.
  // Unica eccezione `npm run dev`, per lavorare sull'interfaccia con i dati di esempio.
  if (config.isErr()) {
    return isPublicPath(request.nextUrl.pathname) ||
      process.env.NODE_ENV === "development"
      ? NextResponse.next({ request })
      : new NextResponse(config.error, { status: 503 });
  }
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
  const { data } = await supabase.auth.getClaims();

  // Prima barriera: senza sessione si va al login. Le pagine e l'API
  // ricontrollano comunque utente e ruolo, e la RLS fa l'ultima verifica.
  if (!data?.claims.sub && !isPublicPath(request.nextUrl.pathname)) {
    const redirect = NextResponse.redirect(loginUrl(appUrl(request.url, request).toString()));
    response.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
};
