import { okAsync, type ResultAsync } from "neverthrow";
import type { AppError } from "../../core/errors";
import type {
  CatalogBook,
  CatalogCollection,
  CatalogLoan,
  CatalogMembership,
  CatalogStore,
} from "../../core/library/catalog";
import { run } from "./book-store";
import type { Supabase } from "./client";

// Colonne leggere: niente trama, note ed extra (tranne la data d'aggiunta di Bookpedia).
export const catalogBookColumns =
  "id, source, source_id, title, subtitle, authors, publisher, published_year, isbn13, pages, format, language, genres, series, series_number, cover_path, cover_url, read_status, rating, favorite, tags, location, date_added:extra->>dateAdded, created_at, updated_at";

// PostgREST restituisce al massimo `max_rows` righe (1000 in config.toml): si legge a pagine.
export const pageSize = 1000;

/** Legge tutte le pagine di una query ordinata, finché una pagina non arriva incompleta. */
export const readAllPages = <T>(
  page: (from: number, to: number) => ResultAsync<readonly T[], AppError>,
  size = pageSize,
): ResultAsync<readonly T[], AppError> => {
  const next = (from: number, done: readonly T[]): ResultAsync<readonly T[], AppError> =>
    page(from, from + size - 1).andThen((rows) =>
      rows.length < size ? okAsync([...done, ...rows]) : next(from + size, [...done, ...rows]),
    );
  return next(0, []);
};

export const supabaseCatalogStore = (supabase: Supabase): CatalogStore => ({
  load: () => {
    const books = readAllPages((from, to) =>
      run(supabase.from("books").select(catalogBookColumns).order("id").range(from, to)).map(
        (rows) => rows as unknown as readonly CatalogBook[],
      ),
    );
    const collections = run(
      supabase.from("collections").select("id, name, position").order("position").order("name"),
    ).map((rows) => rows as readonly CatalogCollection[]);
    const memberships = readAllPages((from, to) =>
      run(
        supabase
          .from("collection_books")
          .select("collection_id, book_id")
          .order("collection_id")
          .order("book_id")
          .range(from, to),
      ).map((rows) => rows as readonly CatalogMembership[]),
    );
    const loans = readAllPages((from, to) =>
      run(
        supabase
          .from("loans")
          .select("book_id, borrower, loaned_on, due_on")
          .is("returned_on", null)
          .order("id")
          .range(from, to),
      ).map((rows) => rows as readonly CatalogLoan[]),
    );
    return books.andThen((bookRows) =>
      collections.andThen((collectionRows) =>
        memberships.andThen((membershipRows) =>
          loans.map((loanRows) => ({
            books: bookRows,
            collections: collectionRows,
            memberships: membershipRows,
            loans: loanRows,
          })),
        ),
      ),
    );
  },
});
