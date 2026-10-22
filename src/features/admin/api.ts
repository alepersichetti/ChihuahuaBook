import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Role } from "@/features/auth/viewer";
import type { Language } from "@/features/i18n/languages";

// Client delle rotte /api/admin. Gli errori sono valori (chiavi dei testi tradotti), mai eccezioni.

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
  readonly language: Language;
};

export type AdminError = "unauthenticated" | "forbidden" | "lastAdmin" | "invalid" | "network" | "unknown";

const errorOf = (status: number): AdminError =>
  status === 401
    ? "unauthenticated"
    : status === 403
      ? "forbidden"
      : status === 409
        ? "lastAdmin"
        : status === 400
          ? "invalid"
          : "unknown";

const request = <T>(path: string, init?: RequestInit): ResultAsync<T, AdminError> =>
  ResultAsync.fromPromise(
    fetch(`/api/admin${path}`, {
      ...init,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
    }),
    (): AdminError => "network",
  ).andThen((response) =>
    !response.ok
      ? errAsync(errorOf(response.status))
      : response.status === 204
        ? okAsync(undefined as T)
        : ResultAsync.fromPromise(response.json() as Promise<T>, (): AdminError => "unknown"),
  );

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
