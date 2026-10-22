import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Book, BookFilter } from "../../core/books/book";
import type { BookStore } from "../../core/books/ports";
import { notFound, unexpected, type AppError } from "../../core/errors";
import type { Supabase } from "./client";

const columns =
  "id, owner_id, title, subtitle, authors, editors, translators, illustrators, publisher, published_year, edition, isbn13, isbn10, pages, format, language, genres, series, series_number, summary, cover_path, cover_url, read_status, started_reading_on, finished_reading_on, rating, favorite, notes, tags, location, condition, signed, purchased_on, purchased_from, purchase_price, estimated_value, currency, source, source_id, created_at, updated_at";

type PostgrestError = { message: string; code?: string };

const fromPostgrest = (error: PostgrestError): AppError =>
  error.code === "23505"
    ? { kind: "conflict", message: error.message }
    : { kind: "unexpected", message: error.message };

type Response<T> = { data: T | null; error: PostgrestError | null };

// Trasforma la risposta di PostgREST (che non lancia mai) in un ResultAsync.
export const run = <T>(query: PromiseLike<Response<T>>): ResultAsync<T, AppError> =>
  ResultAsync.fromPromise(Promise.resolve(query), unexpected).andThen(
    ({ data, error }) =>
      error
        ? errAsync(fromPostgrest(error))
        : data === null
          ? errAsync(notFound)
          : okAsync(data),
  );

// Il builder di supabase-js va "piegato" sui filtri presenti.
type Query = ReturnType<ReturnType<Supabase["from"]>["select"]>;
type Step = (query: Query) => Query;

const filterSteps = (filter: BookFilter): readonly Step[] => [
  (q) =>
    filter.text
      ? q.textSearch("search", filter.text, {
          config: "simple",
          type: "websearch",
        })
      : q,
  (q) => (filter.readStatus ? q.eq("read_status", filter.readStatus) : q),
  (q) => (filter.tag ? q.contains("tags", [filter.tag]) : q),
  (q) =>
    filter.favorite === undefined ? q : q.eq("favorite", filter.favorite),
  (q) =>
    filter.collectionId
      ? q.eq("collection_books.collection_id", filter.collectionId)
      : q,
];

export const supabaseBookStore = (supabase: Supabase): BookStore => {
  const books = () => supabase.from("books");

  return {
    list: ({ filter, sort, ascending, limit, offset }) => {
      // Embed vuoto: filtra per collezione senza aggiungere colonne al risultato.
      const select = filter.collectionId
        ? `${columns}, collection_books!inner()`
        : columns;
      const query = filterSteps(filter)
        .reduce(
          (q, step) => step(q),
          books().select(select, { count: "exact" }),
        )
        .order(sort, { ascending, nullsFirst: false })
        .order("id")
        .range(offset, offset + limit - 1);

      return ResultAsync.fromPromise(
        Promise.resolve(query),
        unexpected,
      ).andThen(({ data, count, error }) =>
        error
          ? errAsync(fromPostgrest(error))
          : okAsync({
              books: (data ?? []) as unknown as Book[],
              total: count ?? 0,
            }),
      );
    },

    get: (id) => run(books().select(columns).eq("id", id).maybeSingle()),

    findByIsbn13: (isbn13) => run(books().select(columns).eq("isbn13", isbn13)),

    insert: (book) => run(books().insert(book).select(columns).single()),

    update: (id, patch) =>
      run(books().update(patch).eq("id", id).select(columns).maybeSingle()),

    remove: (id) =>
      run(books().delete().eq("id", id).select("id")).andThen((deleted) =>
        deleted.length > 0 ? okAsync(undefined) : errAsync(notFound),
      ),
  };
};
