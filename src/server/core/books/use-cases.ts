import { errAsync, ResultAsync } from "neverthrow";
import type { z } from "zod";
import { validationError, type AppError } from "../errors";
import { validate } from "../result";
import {
  normalizeSearchText,
  withDerivedIsbn,
  type Book,
  type BookListRequest,
  type BookPage,
} from "./book";
import { parseIsbn } from "./isbn";
import type { BookStore, IsbnLookup } from "./ports";
import type { BookInput } from "./schema";
import {
  bookIdSchema,
  bookInputSchema,
  bookUpdateSchema,
  listBooksQuerySchema,
} from "./schema";

// Ogni caso d'uso riceve le sue dipendenze e restituisce una funzione
// dall'input grezzo (non validato) a un ResultAsync.

const validId = (id: unknown) =>
  validate(bookIdSchema)(id).mapErr(validationError);

export const toListRequest = (
  query: z.output<typeof listBooksQuerySchema>,
): BookListRequest => ({
  filter: {
    text: query.q ? normalizeSearchText(query.q) || undefined : undefined,
    readStatus: query.status,
    tag: query.tag,
    favorite: query.favorite,
    collectionId: query.collection,
  },
  sort: query.sort,
  ascending: query.order ? query.order === "asc" : query.sort === "title",
  limit: query.limit,
  offset: query.offset,
});

export const listBooks =
  (store: Pick<BookStore, "list">) =>
  (query: unknown): ResultAsync<BookPage, AppError> =>
    validate(listBooksQuerySchema)(query)
      .mapErr(validationError)
      .map(toListRequest)
      .asyncAndThen(store.list);

export const getBook =
  (store: Pick<BookStore, "get">) =>
  (id: unknown): ResultAsync<Book, AppError> =>
    validId(id).asyncAndThen(store.get);

export const createBook =
  (store: Pick<BookStore, "insert">) =>
  (input: unknown): ResultAsync<Book, AppError> =>
    validate(bookInputSchema)(input)
      .mapErr(validationError)
      .map(withDerivedIsbn)
      .asyncAndThen(store.insert);

export const updateBook =
  (store: Pick<BookStore, "update">) =>
  (id: unknown, patch: unknown): ResultAsync<Book, AppError> =>
    validId(id)
      .andThen((validatedId) =>
        validate(bookUpdateSchema)(patch)
          .mapErr(validationError)
          .map((valid) => [validatedId, withDerivedIsbn(valid)] as const),
      )
      .asyncAndThen(([validatedId, valid]) => store.update(validatedId, valid));

export const removeBook =
  (store: Pick<BookStore, "remove">) =>
  (id: unknown): ResultAsync<void, AppError> =>
    validId(id).asyncAndThen(store.remove);

const invalidIsbn = validationError([
  { path: "isbn", message: "ISBN non valido" },
]);

/** Libri già in catalogo con lo stesso ISBN, utile per segnalare duplicati. */
export const findBooksByIsbn =
  (store: Pick<BookStore, "findByIsbn13">) =>
  (raw: string): ResultAsync<readonly Book[], AppError> => {
    const isbn = parseIsbn(raw);
    return isbn ? store.findByIsbn13(isbn.isbn13) : errAsync(invalidIsbn);
  };

export type IsbnReport = {
  readonly isbn13: string;
  readonly isbn10: string | null;
  /** Dati dal catalogo esterno, `null` se l'ISBN non è noto. */
  readonly draft: BookInput | null;
  /** Copie già presenti nel catalogo dell'utente. */
  readonly owned: readonly Book[];
};

/** Tutto ciò che serve per aggiungere un libro partendo dall'ISBN: bozza e duplicati. */
export const inspectIsbn =
  (lookup: IsbnLookup, store: Pick<BookStore, "findByIsbn13">) =>
  (raw: string): ResultAsync<IsbnReport, AppError> => {
    const isbn = parseIsbn(raw);
    if (!isbn) return errAsync(invalidIsbn);
    return ResultAsync.combine([
      lookup(isbn.isbn13),
      store.findByIsbn13(isbn.isbn13),
    ] as const).map(([draft, owned]) => ({
      ...isbn,
      draft: draft && { ...draft, ...isbn },
      owned,
    }));
  };
