import type { ResultAsync } from "neverthrow";
import type { AppError } from "./errors";

/** Porta: chi sta facendo la richiesta. Fallisce con `unauthenticated` se nessuno. */
export type Session = {
  readonly userId: () => ResultAsync<string, AppError>;
};
