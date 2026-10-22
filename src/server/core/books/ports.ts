import type { ResultAsync } from "neverthrow";
import type { AppError } from "../errors";
import type {
  Book,
  BookListRequest,
  BookPage,
  BookPatch,
  NewBook,
} from "./book";
import type { BookInput } from "./schema";

/** Porta verso il magazzino dei libri. Ogni operazione vale solo per l'utente corrente. */
export type BookStore = {
  readonly list: (request: BookListRequest) => ResultAsync<BookPage, AppError>;
  readonly get: (id: string) => ResultAsync<Book, AppError>;
  readonly findByIsbn13: (
    isbn13: string,
  ) => ResultAsync<readonly Book[], AppError>;
  readonly insert: (book: NewBook) => ResultAsync<Book, AppError>;
  readonly update: (
    id: string,
    patch: BookPatch,
  ) => ResultAsync<Book, AppError>;
  readonly remove: (id: string) => ResultAsync<void, AppError>;
};

/** Porta verso un catalogo bibliografico esterno. `null` se l'ISBN non è noto. */
export type IsbnLookup = (
  isbn13: string,
) => ResultAsync<BookInput | null, AppError>;
