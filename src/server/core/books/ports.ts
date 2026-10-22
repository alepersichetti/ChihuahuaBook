import type { ResultAsync } from "neverthrow";
import type { AppError } from "../errors";
import type {
  Book,
  BookListRequest,
  BookPage,
  BookPatch,
  NewBook,
} from "./book";
import type { BookSearchQuery } from "./search";
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

/** Un libro arrivato da un altro programma, con l'id che aveva là. */
export type ImportedBook = NewBook & {
  readonly source: string;
  readonly source_id: string;
  readonly extra: Readonly<Record<string, unknown>>;
};

export type ImportedRef = { readonly id: string; readonly source_id: string };

/** Porta per gli import: ritrova i libri già importati dalla stessa fonte. */
export type ImportStore = {
  readonly findBySource: (
    source: string,
    sourceIds: readonly string[],
  ) => ResultAsync<readonly ImportedRef[], AppError>;
  readonly insertMany: (
    books: readonly ImportedBook[],
  ) => ResultAsync<readonly ImportedRef[], AppError>;
  readonly replace: (
    id: string,
    book: ImportedBook,
  ) => ResultAsync<void, AppError>;
};

/** Porta verso lo spazio file delle copertine. Restituisce il percorso salvato. */
export type CoverStore = {
  readonly put: (
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ) => ResultAsync<string, AppError>;
};

/** Ricerca di libri in un catalogo esterno: un risultato è una bozza da rivedere. */
export type SearchHit = {
  readonly source: string;
  readonly sourceId: string;
  /** Pagina del libro sul sito della fonte, se c'è. */
  readonly link: string | null;
  readonly draft: BookInput;
};

export type BookSearch = (
  query: BookSearchQuery,
) => ResultAsync<readonly SearchHit[], AppError>;

/** Una fonte di ricerca intercambiabile (Google Books oggi, altre domani). */
export type SearchSource = {
  readonly id: string;
  readonly label: string;
  readonly search: BookSearch;
};
