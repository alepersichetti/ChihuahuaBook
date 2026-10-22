import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { validationError, type AppError } from "../errors";
import { validate } from "../result";
import { parseIsbn } from "./isbn";
import type { SearchHit, SearchSource } from "./ports";

export const searchFields = ["any", "isbn", "title", "author"] as const;

export type SearchField = (typeof searchFields)[number];

export type BookSearchQuery = {
  readonly field: SearchField;
  readonly text: string;
  readonly limit: number;
};

// Parametri da query string: ?source=google_books&q=...&field=title
export const bookSearchParamsSchema = z.object({
  source: z.string().trim().min(1, "Scegli una fonte"),
  q: z.string().trim().min(1, "Scrivi cosa cercare").max(200),
  field: z.enum(searchFields).default("any"),
  limit: z.coerce.number().int().min(1).max(40).default(20),
});

export type SourceInfo = { readonly id: string; readonly label: string };

const issue = (path: string, message: string) =>
  validationError([{ path, message }]);

/**
 * Un ISBN valido scritto nella ricerca libera diventa una ricerca per ISBN;
 * nel campo ISBN, invece, deve esserlo davvero.
 */
export const toSearchQuery = (
  params: z.output<typeof bookSearchParamsSchema>,
): BookSearchQuery | null => {
  const isbn = params.field === "any" || params.field === "isbn"
    ? parseIsbn(params.q)
    : null;
  if (params.field === "isbn" && !isbn) return null;
  return isbn
    ? { field: "isbn", text: isbn.isbn13, limit: params.limit }
    : { field: params.field, text: params.q, limit: params.limit };
};

export const listSources = (
  sources: readonly SearchSource[],
): readonly SourceInfo[] => sources.map(({ id, label }) => ({ id, label }));

/** Cerca nella fonte scelta; le bozze vanno riviste prima di salvarle. */
export const searchBooks =
  (sources: readonly SearchSource[]) =>
  (raw: unknown): ResultAsync<readonly SearchHit[], AppError> =>
    validate(bookSearchParamsSchema)(raw)
      .mapErr(validationError)
      .asyncAndThen((params) => {
        const source = sources.find(({ id }) => id === params.source);
        if (!source) return errAsync(issue("source", "Fonte non disponibile"));
        const query = toSearchQuery(params);
        if (!query) return errAsync(issue("q", "ISBN non valido"));
        return okAsync(query).andThen(source.search);
      });
