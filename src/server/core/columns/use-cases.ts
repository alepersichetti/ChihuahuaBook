import { errAsync, type ResultAsync } from "neverthrow";
import { bookIdSchema } from "../books/schema";
import { notFound, validationError, type AppError } from "../errors";
import { validate } from "../result";
import { columnKeySchema, columnRenameSchema, columnsInputSchema, fieldValueSchema, type CustomColumn } from "./column";
import type { ColumnStore } from "./ports";

// Casi d'uso delle colonne personalizzate: validano l'input grezzo e chiamano il magazzino.

const validKey = (key: unknown) => validate(columnKeySchema)(key).mapErr(validationError);

export const listColumns = (store: Pick<ColumnStore, "list">) => (): ResultAsync<readonly CustomColumn[], AppError> =>
  store.list();

/** Due colonne con la stessa chiave nella stessa richiesta: vale la prima. */
const firstByKey = <T extends { readonly key: string }>(columns: readonly T[]) => [
  ...new Map(columns.toReversed().map((column) => [column.key, column])).values(),
].toReversed();

export const ensureColumns =
  (store: Pick<ColumnStore, "ensure">) =>
  (input: unknown): ResultAsync<readonly CustomColumn[], AppError> =>
    validate(columnsInputSchema)(input)
      .mapErr(validationError)
      .asyncAndThen(({ columns }) => store.ensure(firstByKey(columns)));

export const removeColumn =
  (store: Pick<ColumnStore, "remove">) =>
  (key: unknown): ResultAsync<void, AppError> =>
    validKey(key).asyncAndThen(store.remove);

export const renameColumn =
  (store: Pick<ColumnStore, "rename">) =>
  (key: unknown, input: unknown): ResultAsync<CustomColumn, AppError> =>
    validKey(key)
      .andThen((column) => validate(columnRenameSchema)(input).mapErr(validationError).map(({ label }) => ({ column, label })))
      .asyncAndThen(({ column, label }) => store.rename(column, label));

export const setFieldValue =
  (store: Pick<ColumnStore, "setValue" | "list">) =>
  (bookId: unknown, key: unknown, input: unknown): ResultAsync<void, AppError> =>
    validate(bookIdSchema)(bookId)
      .mapErr(validationError)
      .andThen((id) => validKey(key).map((column) => ({ id, column })))
      .andThen((ids) => validate(fieldValueSchema)(input).mapErr(validationError).map(({ value }) => ({ ...ids, value })))
      .asyncAndThen(({ id, column, value }) =>
        // Si scrive solo in una colonna che esiste e che non legge un campo del catalogo.
        store.list().andThen((columns) => {
          const target = columns.find((item) => item.key === column);
          if (!target) return errAsync(notFound);
          if (target.catalog_field !== null)
            return errAsync(
              validationError([{ path: "key", message: "Questa colonna mostra un campo del catalogo: si modifica dal libro" }]),
            );
          return store.setValue(id, target.extra_key ?? target.key, value?.trim() || null);
        }),
      );
