import "server-only";
import { okAsync, ResultAsync } from "neverthrow";
import type { ViewerState } from "@/features/auth/viewer";
import { isRole, type Role } from "@/server/core/auth/roles";
import { createClient } from "@/lib/supabase/server";

// Solo in `npm run dev` senza Supabase: l'interfaccia gira sui dati di esempio
// con un utente finto (ruolo da DEMO_ROLE, predefinito admin) per lavorare sulla UI.
const demoViewer = (): ViewerState => {
  const role = process.env.DEMO_ROLE;
  return { status: "member", userId: "demo", email: "demo@localhost", role: isRole(role) ? role : ("admin" satisfies Role) };
};

const anonymous: ViewerState = { status: "anonymous" };

/**
 * Data Access Layer della sessione: chi è collegato e con quale ruolo.
 * getClaims verifica il token; il ruolo si legge dal database come fa la RLS.
 * Senza configurazione: utente finto in sviluppo, nessun accesso altrove.
 */
export const getViewer = (): Promise<ViewerState> =>
  createClient()
    .andThen((supabase) =>
      ResultAsync.fromSafePromise(supabase.auth.getClaims()).andThen(({ data }) => {
        const claims = data?.claims;
        if (!claims?.sub) return okAsync(anonymous);
        const sub = claims.sub;
        const email = typeof claims.email === "string" ? claims.email : "";
        return ResultAsync.fromSafePromise(Promise.resolve(supabase.rpc("member_role"))).map(
          ({ data: role }): ViewerState =>
            isRole(role) ? { status: "member", userId: sub, email, role } : { status: "inactive", email },
        );
      }),
    )
    .unwrapOr(process.env.NODE_ENV === "development" ? demoViewer() : anonymous);
