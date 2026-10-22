// Errori di Supabase Auth ridotti a poche chiavi, tradotte in t.auth.errors.
// Volutamente generici sul login, per non rivelare quali email sono registrate.

type AuthError = { readonly message: string; readonly code?: string; readonly status?: number };

export type AuthErrorKey =
  | "rateLimited"
  | "weakPassword"
  | "emailNotConfirmed"
  | "samePassword"
  | "reauthenticate"
  | "inviteOnly"
  | "invalidCredentials"
  | "generic";

export const authErrorKey = (error: AuthError, during: "signin" | "signup" | "reset" | "password"): AuthErrorKey => {
  const code = error.code ?? "";
  if (error.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit")
    return "rateLimited";
  if (code === "weak_password") return "weakPassword";
  if (code === "email_not_confirmed") return "emailNotConfirmed";
  if (code === "same_password") return "samePassword";
  if (code === "reauthentication_needed") return "reauthenticate";
  if (during === "signup" && (code === "unexpected_failure" || /database error/i.test(error.message)))
    return "inviteOnly";
  if (during === "signin") return "invalidCredentials";
  return "generic";
};
