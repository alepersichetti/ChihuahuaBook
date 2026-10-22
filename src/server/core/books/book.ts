import type { z } from "zod";
import { isbn10To13, isbn13To10 } from "./isbn";
import type { bookInputSchema, bookSorts, ReadStatus } from "./schema";

/** Un libro valido pronto da salvare. */
export type NewBook = z.output<typeof bookInputSchema>;

/** Una modifica parziale già validata. */
export type BookPatch = Partial<NewBook>;

type Stored<T> = { readonly [K in keyof T]-?: Exclude<T[K], undefined> };

/** Un libro come salvato nel catalogo. */
export type Book = Stored<NewBook> & {
  readonly id: string;
  readonly owner_id: string;
  readonly source: string | null;
  readonly source_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type BookSort = (typeof bookSorts)[number];

export type BookFilter = {
  readonly text?: string;
  readonly readStatus?: ReadStatus;
  readonly tag?: string;
  readonly favorite?: boolean;
  readonly collectionId?: string;
};

export type BookListRequest = {
  readonly filter: BookFilter;
  readonly sort: BookSort;
  readonly ascending: boolean;
  readonly limit: number;
  readonly offset: number;
};

export type BookPage = {
  readonly books: readonly Book[];
  readonly total: number;
};

/** Toglie gli accenti, come fa la colonna di ricerca nel database. */
export const normalizeSearchText = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

/** Se manca una delle due forme dell'ISBN, la ricava dall'altra. */
export const withDerivedIsbn = <
  T extends { isbn13?: string | null; isbn10?: string | null },
>(
  book: T,
): T =>
  book.isbn13 && !book.isbn10
    ? { ...book, isbn10: isbn13To10(book.isbn13) }
    : book.isbn10 && !book.isbn13
      ? { ...book, isbn13: isbn10To13(book.isbn10) }
      : book;
