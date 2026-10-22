import type { ResultAsync } from "neverthrow";
import type { Viewer } from "./auth/roles";
import type { AppError } from "./errors";

/**
 * Porta: chi sta facendo la richiesta.
 * Fallisce con `unauthenticated` se nessuno, con `forbidden` se l'utente
 * non è un membro attivo dell'istanza.
 */
export type Session = {
  readonly viewer: () => ResultAsync<Viewer, AppError>;
};
