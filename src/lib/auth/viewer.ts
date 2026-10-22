import "server-only";
import type { ViewerState } from "@/features/auth/viewer";
import { isRole, type Role } from "@/server/core/auth/roles";
import { readConfig } from "@/server/config";
import { createClient } from "@/lib/supabase/server";

// Solo in `npm run dev` senza Supabase: l'interfaccia gira sui dati di esempio
// con un utente finto (ruolo da DEMO_ROLE, predefinito admin) per lavorare sulla UI.
const demoViewer = (): ViewerState | null => {
  if (process.env.NODE_ENV !== "development" || readConfig(process.env).isOk()) return null;
  const role = process.env.DEMO_ROLE;
  return { status: "member", userId: "demo", email: "demo@localhost", role: isRole(role) ? role : ("admin" satisfies Role) };
};

/**
 * Data Access Layer della sessione: chi è collegato e con quale ruolo.
 * getClaims verifica il token; il ruolo si legge dal database come fa la RLS.
 */
export async function getViewer(): Promise<ViewerState> {
  const demo = demoViewer();
  if (demo) return demo;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { status: "anonymous" };
  const email = typeof claims.email === "string" ? claims.email : "";
  const { data: role } = await supabase.rpc("member_role");
  return isRole(role)
    ? { status: "member", userId: claims.sub, email, role }
    : { status: "inactive", email };
}
