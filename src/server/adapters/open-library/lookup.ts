import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { IsbnLookup } from "../../core/books/ports";
import type { BookInput } from "../../core/books/schema";
import type { AppError } from "../../core/errors";

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

const yearOf = (date: string | undefined): number | null => {
  const match = date?.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
};

export const toBookDraft = (entry: Entry): BookInput => ({
  title: entry.title,
  subtitle: entry.subtitle ?? null,
  authors: entry.authors?.map((author) => author.name) ?? [],
  publisher: entry.publishers?.[0]?.name ?? null,
  published_year: yearOf(entry.publish_date),
  pages: entry.number_of_pages ?? null,
  genres: entry.subjects?.slice(0, 5).map((subject) => subject.name) ?? [],
  cover_url: entry.cover?.large ?? entry.cover?.medium ?? null,
});

const upstream = (message: string): AppError => ({ kind: "upstream", message });

/** Implementazione di IsbnLookup su Open Library, con `fetch` iniettabile. */
export const openLibraryLookup =
  (fetchImpl: typeof fetch = fetch): IsbnLookup =>
  (isbn13) => {
    const url = new URL("https://openlibrary.org/api/books");
    url.searchParams.set("bibkeys", `ISBN:${isbn13}`);
    url.searchParams.set("format", "json");
    url.searchParams.set("jscmd", "data");

    return ResultAsync.fromPromise(
      fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }),
      (error) => upstream(String(error)),
    )
      .andThen((response) =>
        response.ok
          ? ResultAsync.fromPromise(
              response.json() as Promise<unknown>,
              (error) => upstream(String(error)),
            )
          : errAsync(upstream(`Open Library ha risposto ${response.status}`)),
      )
      .andThen((body) => {
        const parsed = responseSchema.safeParse(body);
        if (!parsed.success) return errAsync(upstream(parsed.error.message));
        const entry = parsed.data[`ISBN:${isbn13}`];
        return okAsync(entry ? toBookDraft(entry) : null);
      });
  };
