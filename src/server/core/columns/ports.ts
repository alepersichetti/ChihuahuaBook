import type { ResultAsync } from "neverthrow";
import type { AppError } from "../errors";
import type { ColumnInput, CustomColumn } from "./column";

/** Porta verso le colonne personalizzate della biblioteca. */
export type ColumnStore = {
  readonly list: () => ResultAsync<readonly CustomColumn[], AppError>;
  /** Crea le colonne che mancano (stessa chiave = stessa colonna) e restituisce tutte quelle esistenti. */
  readonly ensure: (columns: readonly ColumnInput[]) => ResultAsync<readonly CustomColumn[], AppError>;
  readonly remove: (key: string) => ResultAsync<void, AppError>;
  /** Scrive il valore in books.extra[extraKey]; null lo toglie. `not_found` se il libro non c'è. */
  readonly setValue: (bookId: string, extraKey: string, value: string | null) => ResultAsync<void, AppError>;
};
