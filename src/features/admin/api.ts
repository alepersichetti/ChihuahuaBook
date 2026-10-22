import type { Role } from "@/features/auth/viewer";

// Client delle rotte /api/admin. Ogni chiamata restituisce un esito, mai un'eccezione.

export type Member = {
  readonly user_id: string;
  readonly email: string;
  readonly display_name: string | null;
  readonly role: Role;
  readonly active: boolean;
  readonly created_at: string;
};

export type Invitation = {
  readonly email: string;
  readonly role: Role;
  readonly created_at: string;
  readonly expires_at: string;
};

export type InstanceSettings = {
  readonly open_signup: boolean;
  readonly signup_role: "reader" | "librarian";
};

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

const messages: Readonly<Record<number, string>> = {
  401: "Sessione scaduta: accedi di nuovo.",
  403: "Non hai i permessi per questa operazione.",
  409: "Operazione non consentita: deve restare almeno un amministratore attivo.",
};

const request = async <T>(path: string, init?: RequestInit): Promise<ApiResult<T>> => {
  try {
    const response = await fetch(`/api/admin${path}`, {
      ...init,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
    });
    if (response.ok) {
      return { ok: true, value: (response.status === 204 ? undefined : await response.json()) as T };
    }
    const body = (await response.json().catch(() => ({}))) as { issues?: { message: string }[] };
    return {
      ok: false,
      message: body.issues?.[0]?.message ?? messages[response.status] ?? "Qualcosa non ha funzionato.",
    };
  } catch {
    return { ok: false, message: "Connessione non riuscita." };
  }
};

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const adminApi = {
  members: () => request<readonly Member[]>("/members"),
  updateMember: (id: string, patch: Partial<Pick<Member, "role" | "active">>) =>
    request<Member>(`/members/${id}`, send("PATCH", patch)),
  invitations: () => request<readonly Invitation[]>("/invitations"),
  invite: (email: string, role: Role) => request<Invitation>("/invitations", send("POST", { email, role })),
  revoke: (email: string) => request<void>(`/invitations/${encodeURIComponent(email)}`, send("DELETE")),
  settings: () => request<InstanceSettings>("/settings"),
  updateSettings: (patch: Partial<InstanceSettings>) => request<InstanceSettings>("/settings", send("PATCH", patch)),
};
