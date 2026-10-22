// Messaggi di Supabase Auth tradotti per l'utente. Volutamente generici sul login,
// per non rivelare quali email sono registrate.

type AuthError = { readonly message: string; readonly code?: string; readonly status?: number };

export const authErrorMessage = (error: AuthError, during: "signin" | "signup" | "reset" | "password"): string => {
  const code = error.code ?? "";
  if (error.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit")
    return "Troppi tentativi. Aspetta qualche minuto e riprova.";
  if (code === "weak_password")
    return "Password troppo debole: usa almeno 10 caratteri, con lettere e numeri.";
  if (code === "email_not_confirmed") return "Conferma prima l'email: ti abbiamo mandato un link.";
  if (code === "same_password") return "La nuova password deve essere diversa da quella attuale.";
  if (code === "reauthentication_needed") return "Per sicurezza accedi di nuovo prima di cambiare password.";
  if (during === "signup" && (code === "unexpected_failure" || /database error/i.test(error.message)))
    return "La registrazione è su invito: chiedi all'amministratore di invitare la tua email.";
  if (during === "signin") return "Email o password non corretti.";
  return "Qualcosa non ha funzionato. Riprova tra poco.";
};
