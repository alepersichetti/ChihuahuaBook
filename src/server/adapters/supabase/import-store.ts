import { okAsync, type ResultAsync } from "neverthrow";
import type {
  CatalogEntry,
  CoverStore,
  ImportedBook,
  ImportedRef,
  ImportStore,
} from "../../core/books/ports";
import type { AppError } from "../../core/errors";
import { run } from "./book-store";
import type { Supabase } from "./client";
import type { Json } from "./database.types";

// PostgREST mette gli id nella query string: a gruppi resta sotto i limiti degli URL.
const idChunk = 100;
// PostgREST restituisce al massimo 1000 righe per richiesta.
const pageSize = 1000;

const chunks = <T>(values: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );

/** Esegue `step` su ogni gruppo, uno dopo l'altro, e unisce i risultati. */
const sequence = <T, R>(
  groups: readonly T[],
  step: (group: T) => ResultAsync<readonly R[], AppError>,
): ResultAsync<readonly R[], AppError> =>
  groups.reduce<ResultAsync<readonly R[], AppError>>(
    (done, group) => done.andThen((acc) => step(group).map((rows) => [...acc, ...rows])),
    okAsync([]),
  );

const toRow = (book: ImportedBook) => ({ ...book, extra: book.extra as Json });

const refColumns = "id, source_id, import_hash";

const toRefs = (
  rows: readonly { id: string; source_id: string | null; import_hash: string | null }[],
): ImportedRef[] =>
  rows.flatMap((row) =>
    row.source_id
      ? [{ id: row.id, source_id: row.source_id, import_hash: row.import_hash }]
      : [],
  );

export const supabaseImportStore = (supabase: Supabase): ImportStore => {
  const books = () => supabase.from("books");

  const listPage = (
    from: number,
  ): ResultAsync<readonly CatalogEntry[], AppError> =>
    run(
      books()
        .select("id, source, source_id, cover_path")
        .order("id")
        .range(from, from + pageSize - 1),
    ).andThen((rows) =>
      rows.length < pageSize
        ? okAsync(rows)
        : listPage(from + pageSize).map((rest) => [...rows, ...rest]),
    );

  return {
    findBySource: (source, sourceIds) =>
      sequence(chunks(sourceIds, idChunk), (ids) =>
        run(
          books().select(refColumns).eq("source", source).in("source_id", ids),
        ).map(toRefs),
      ),

    insertMany: (rows) =>
      run(books().insert(rows.map(toRow)).select(refColumns)).map(toRefs),

    replace: (id, book) =>
      run(books().update(toRow(book)).eq("id", id).select("id")).map(
        () => undefined,
      ),

    listAll: () => listPage(0),

    removeMany: (ids) =>
      sequence(chunks(ids, idChunk), (group) =>
        run(books().delete().in("id", group).select("id")),
      ).map(() => undefined),
  };
};

export const supabaseCoverStore = (
  supabase: Supabase,
  bucket = "covers",
): CoverStore => ({
  put: (path, bytes, contentType) =>
    run(
      supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: true })
        .then(({ data, error }) => ({
          data: data ? data.path : null,
          error: error ? { message: error.message } : null,
        })),
    ),

  remove: (paths) =>
    sequence(chunks(paths, idChunk), (group) =>
      run(
        supabase.storage
          .from(bucket)
          .remove(group)
          .then(({ data, error }) => ({
            data: data ?? [],
            error: error ? { message: error.message } : null,
          })),
      ),
    ).map(() => undefined),
});
