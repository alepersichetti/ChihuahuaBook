import { okAsync } from "neverthrow";
import type {
  CoverStore,
  ImportedBook,
  ImportStore,
} from "../../core/books/ports";
import { run } from "./book-store";
import type { Supabase } from "./client";
import type { Json } from "./database.types";

// PostgREST mette gli id nella query string: a gruppi resta sotto i limiti degli URL.
const lookupChunk = 100;

const chunks = <T>(values: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );

const toRow = (book: ImportedBook) => ({ ...book, extra: book.extra as Json });

export const supabaseImportStore = (supabase: Supabase): ImportStore => {
  const books = () => supabase.from("books");

  return {
    findBySource: (source, sourceIds) =>
      chunks(sourceIds, lookupChunk).reduce(
        (found, ids) =>
          found.andThen((acc) =>
            run(
              books()
                .select("id, source_id")
                .eq("source", source)
                .in("source_id", ids),
            ).map((rows) => [
              ...acc,
              ...rows.flatMap((row) =>
                row.source_id ? [{ id: row.id, source_id: row.source_id }] : [],
              ),
            ]),
          ),
        okAsync([]) as ReturnType<ImportStore["findBySource"]>,
      ),

    insertMany: (rows) =>
      run(books().insert(rows.map(toRow)).select("id, source_id")).map((saved) =>
        saved.flatMap((row) =>
          row.source_id ? [{ id: row.id, source_id: row.source_id }] : [],
        ),
      ),

    replace: (id, book) =>
      run(books().update(toRow(book)).eq("id", id).select("id")).map(
        () => undefined,
      ),
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
});
