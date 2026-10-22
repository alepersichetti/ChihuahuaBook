import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Enums,
  Tables,
  TablesUpdate,
} from "@/lib/supabase/database.types";
import { databaseError, type BookError } from "./errors";
import { isbn10To13, isbn13To10, parseIsbn } from "./isbn";
import {
  bookInputSchema,
  bookUpdateSchema,
  type BookInput,
  type BookUpdate,
} from "./schema";

export type Book = Omit<Tables<"books">, "search">;
type Client = SupabaseClient<Database>;

const columns =
  "id, owner_id, title, subtitle, authors, editors, translators, illustrators, publisher, published_year, edition, isbn13, isbn10, pages, format, language, genres, series, series_number, summary, cover_path, cover_url, read_status, started_reading_on, finished_reading_on, rating, favorite, notes, tags, location, condition, signed, purchased_on, purchased_from, purchase_price, estimated_value, currency, source, source_id, extra, created_at, updated_at";

export type BookSort = "created_at" | "title" | "published_year" | "rating";

export type ListBooksOptions = {
  query?: string;
  readStatus?: Enums<"read_status">;
  tag?: string;
  favorite?: boolean;
  collectionId?: string;
  sort?: BookSort;
  ascending?: boolean;
  limit?: number;
  offset?: number;
};

export type BookPage = { books: Book[]; total: number };

// La colonna `search` è senza accenti: togliamo gli accenti anche dalla query.
export function normalizeQuery(query: string): string {
  return query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function withDerivedIsbn<
  T extends { isbn13?: string | null; isbn10?: string | null },
>(book: T): T {
  if (book.isbn13 && !book.isbn10) {
    return { ...book, isbn10: isbn13To10(book.isbn13) };
  }
  if (book.isbn10 && !book.isbn13) {
    return { ...book, isbn13: isbn10To13(book.isbn10) };
  }
  return book;
}

export function listBooks(
  supabase: Client,
  options: ListBooksOptions = {},
): ResultAsync<BookPage, BookError> {
  const {
    sort = "created_at",
    ascending = sort === "title",
    limit = 50,
    offset = 0,
  } = options;

  const select = options.collectionId
    ? // Embed vuoto: filtra per collezione senza aggiungere colonne al risultato.
      `${columns}, collection_books!inner()`
    : columns;

  let request = supabase.from("books").select(select, { count: "exact" });

  const query = options.query ? normalizeQuery(options.query) : "";
  if (query) {
    request = request.textSearch("search", query, {
      config: "simple",
      type: "websearch",
    });
  }
  if (options.readStatus)
    request = request.eq("read_status", options.readStatus);
  if (options.tag) request = request.contains("tags", [options.tag]);
  if (options.favorite !== undefined)
    request = request.eq("favorite", options.favorite);
  if (options.collectionId) {
    request = request.eq(
      "collection_books.collection_id",
      options.collectionId,
    );
  }

  return ResultAsync.fromSafePromise(
    request
      .order(sort, { ascending, nullsFirst: false })
      .order("id")
      .range(offset, offset + limit - 1),
  ).andThen(({ data, count, error }) => {
    if (error) return errAsync(databaseError(error));
    const books = data as unknown as Book[];
    return okAsync({ books, total: count ?? books.length });
  });
}

export function getBook(
  supabase: Client,
  id: string,
): ResultAsync<Book, BookError> {
  return ResultAsync.fromSafePromise(
    supabase.from("books").select(columns).eq("id", id).maybeSingle(),
  ).andThen(({ data, error }) => {
    if (error) return errAsync(databaseError(error));
    if (!data) return errAsync<Book, BookError>({ kind: "not_found" });
    return okAsync(data);
  });
}

export function findBooksByIsbn(
  supabase: Client,
  rawIsbn: string,
): ResultAsync<Book[], BookError> {
  const isbn = parseIsbn(rawIsbn);
  if (!isbn) return okAsync([]);
  return ResultAsync.fromSafePromise(
    supabase.from("books").select(columns).eq("isbn13", isbn.isbn13),
  ).andThen(({ data, error }) =>
    error ? errAsync(databaseError(error)) : okAsync(data),
  );
}

export function createBook(
  supabase: Client,
  input: BookInput,
): ResultAsync<Book, BookError> {
  const parsed = bookInputSchema.safeParse(input);
  if (!parsed.success) {
    return errAsync({ kind: "validation", issues: parsed.error.issues });
  }
  return ResultAsync.fromSafePromise(
    supabase
      .from("books")
      .insert(withDerivedIsbn(parsed.data))
      .select(columns)
      .single(),
  ).andThen(({ data, error }) =>
    error ? errAsync(databaseError(error)) : okAsync(data),
  );
}

export function updateBook(
  supabase: Client,
  id: string,
  patch: BookUpdate,
): ResultAsync<Book, BookError> {
  const parsed = bookUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return errAsync({ kind: "validation", issues: parsed.error.issues });
  }
  const update: TablesUpdate<"books"> = withDerivedIsbn(parsed.data);
  return ResultAsync.fromSafePromise(
    supabase
      .from("books")
      .update(update)
      .eq("id", id)
      .select(columns)
      .maybeSingle(),
  ).andThen(({ data, error }) => {
    if (error) return errAsync(databaseError(error));
    if (!data) return errAsync<Book, BookError>({ kind: "not_found" });
    return okAsync(data);
  });
}

export function deleteBook(
  supabase: Client,
  id: string,
): ResultAsync<void, BookError> {
  return ResultAsync.fromSafePromise(
    supabase.from("books").delete().eq("id", id).select("id"),
  ).andThen(({ data, error }) => {
    if (error) return errAsync(databaseError(error));
    if (!data?.length) return errAsync<void, BookError>({ kind: "not_found" });
    return okAsync(undefined);
  });
}
