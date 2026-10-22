import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import { parseIsbn } from "./isbn";
import type { BookInput } from "./schema";

export type LookupError =
  | { kind: "invalid_isbn" }
  | { kind: "network"; message: string }
  | { kind: "bad_response"; message: string };

const named = z.array(z.object({ name: z.string() })).optional();

const entrySchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  authors: named,
  publishers: named,
  subjects: named,
  publish_date: z.string().optional(),
  number_of_pages: z.number().optional(),
  cover: z
    .object({
      small: z.url().optional(),
      medium: z.url().optional(),
      large: z.url().optional(),
    })
    .optional(),
});

const responseSchema = z.record(z.string(), entrySchema);

type Entry = z.infer<typeof entrySchema>;

function yearOf(date: string | undefined): number | null {
  const match = date?.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

export function toBookDraft(
  entry: Entry,
  isbn: { isbn13: string; isbn10: string | null },
): BookInput {
  return {
    title: entry.title,
    subtitle: entry.subtitle ?? null,
    authors: entry.authors?.map((author) => author.name) ?? [],
    publisher: entry.publishers?.[0]?.name ?? null,
    published_year: yearOf(entry.publish_date),
    pages: entry.number_of_pages ?? null,
    genres: entry.subjects?.slice(0, 5).map((subject) => subject.name) ?? [],
    cover_url: entry.cover?.large ?? entry.cover?.medium ?? null,
    isbn13: isbn.isbn13,
    isbn10: isbn.isbn10,
  };
}

/**
 * Cerca i dati bibliografici su Open Library.
 * Restituisce null se l'ISBN è valido ma il libro non è presente.
 */
export function lookupIsbn(
  rawIsbn: string,
  fetchImpl: typeof fetch = fetch,
): ResultAsync<BookInput | null, LookupError> {
  const isbn = parseIsbn(rawIsbn);
  if (!isbn) return errAsync({ kind: "invalid_isbn" });

  const url = new URL("https://openlibrary.org/api/books");
  url.searchParams.set("bibkeys", `ISBN:${isbn.isbn13}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("jscmd", "data");

  return ResultAsync.fromPromise(
    fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }),
    (error): LookupError => ({ kind: "network", message: String(error) }),
  )
    .andThen((response) =>
      response.ok
        ? ResultAsync.fromPromise(
            response.json() as Promise<unknown>,
            (error): LookupError => ({
              kind: "bad_response",
              message: String(error),
            }),
          )
        : errAsync<unknown, LookupError>({
            kind: "network",
            message: `Open Library ha risposto ${response.status}`,
          }),
    )
    .andThen((body) => {
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) {
        return errAsync<BookInput | null, LookupError>({
          kind: "bad_response",
          message: parsed.error.message,
        });
      }
      const entry = parsed.data[`ISBN:${isbn.isbn13}`];
      return okAsync(entry ? toBookDraft(entry, isbn) : null);
    });
}
