import type { Role } from "@/server/core/auth/roles";
import { env } from "./env";
import type { TestUser } from "./users";

// Chiamate dirette al Supabase locale con la chiave di servizio, fuori dal browser:
// per preparare utenti senza passare dalle email e per controllare cosa è stato salvato.

const headers = {
  apikey: env.secretKey,
  Authorization: `Bearer ${env.secretKey}`,
  "Content-Type": "application/json",
};

const call = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${env.supabaseUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const body = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${body}`);
  return body ? JSON.parse(body) : null;
};

/** Come la vede la pagina di accesso: "first_admin" solo con il database vuoto. */
export const signupMode = (): Promise<string> =>
  fetch(`${env.supabaseUrl}/rest/v1/rpc/signup_mode`, {
    method: "POST",
    headers: { apikey: env.supabaseKey, "Content-Type": "application/json" },
    body: "{}",
  }).then((response) => response.json());

/**
 * Crea un membro già confermato: un invito, poi l'utente (il trigger lo fa entrare
 * come lettore) e infine il ruolo voluto.
 */
export const createMember = async (user: TestUser) => {
  await call("/rest/v1/invitations", { method: "POST", body: JSON.stringify({ email: user.email }) });
  const created = await call("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: user.name },
    }),
  });
  if (user.role !== "reader") await setRole(created.id, user.role);
  return created.id as string;
};

export const setRole = (userId: string, role: Role) =>
  call(`/rest/v1/members?user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ role }) });

export const memberRole = async (email: string): Promise<Role | null> => {
  const rows = await call(`/rest/v1/members?select=role&email=eq.${encodeURIComponent(email)}`);
  return rows[0]?.role ?? null;
};

export type SavedBook = { readonly title: string; readonly isbn13: string | null; readonly authors: string[] };

/** I libri salvati sul server con questo titolo. */
export const booksTitled = (title: string): Promise<SavedBook[]> =>
  call(`/rest/v1/books?select=title,isbn13,authors&title=eq.${encodeURIComponent(title)}`);

/** La lingua dell'istanza, per rimetterla a posto dopo il test che la cambia. */
export const setInstanceLanguage = (language: "it" | "en") =>
  call("/rest/v1/instance_settings?id=eq.true", { method: "PATCH", body: JSON.stringify({ language }) });
