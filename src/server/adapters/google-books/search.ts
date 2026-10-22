import { errAsync, okAsync } from "neverthrow";
import { z } from "zod";
import { cleanIsbn, isValidIsbn10, isValidIsbn13 } from "../../core/books/isbn";
import type { SearchHit, SearchSource } from "../../core/books/ports";
import type { BookSearchQuery } from "../../core/books/search";
import { fetchJson, upstream, yearOf } from "../http";

const volumeSchema = z.object({
  id: z.string(),
  volumeInfo: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    authors: z.array(z.string()).optional(),
    publisher: z.string().optional(),
    publishedDate: z.string().optional(),
    description: z.string().optional(),
    industryIdentifiers: z
      .array(z.object({ type: z.string(), identifier: z.string() }))
      .optional(),
    pageCount: z.number().optional(),
    categories: z.array(z.string()).optional(),
    language: z.string().optional(),
    imageLinks: z.record(z.string(), z.string()).optional(),
    infoLink: z.string().optional(),
    canonicalVolumeLink: z.string().optional(),
  }),
});

const responseSchema = z.object({
  items: z.array(z.unknown()).optional(),
});

type Volume = z.infer<typeof volumeSchema>;

// Google Books ha una sintassi propria per cercare in un solo campo.
export const toGoogleQuery = ({ field, text }: BookSearchQuery): string => {
  switch (field) {
    case "isbn":
      return `isbn:${text}`;
    case "title":
      return `intitle:${text}`;
    case "author":
      return `inauthor:${text}`;
    case "any":
      return text;
  }
};

const identifier = (volume: Volume, type: string, valid: (value: string) => boolean) => {
  const value = volume.volumeInfo.industryIdentifiers
    ?.filter((id) => id.type === type)
    .map((id) => cleanIsbn(id.identifier))
    .find(valid);
  return value ?? null;
};

// Le miniature arrivano in http e con l'effetto "pagina piegata": meglio togliere entrambi.
export const coverOf = (links: Readonly<Record<string, string>> | undefined) => {
  const url =
    links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail ?? links?.smallThumbnail;
  return url ? url.replace(/^http:/, "https:").replace(/&edge=curl/g, "") : null;
};

export const toSearchHit = (volume: Volume): SearchHit | null => {
  const info = volume.volumeInfo;
  if (!info.title?.trim()) return null;
  return {
    source: "google_books",
    sourceId: volume.id,
    link: info.canonicalVolumeLink ?? info.infoLink ?? null,
    draft: {
      title: info.title,
      subtitle: info.subtitle ?? null,
      authors: info.authors ?? [],
      publisher: info.publisher ?? null,
      published_year: yearOf(info.publishedDate),
      isbn13: identifier(volume, "ISBN_13", isValidIsbn13),
      isbn10: identifier(volume, "ISBN_10", isValidIsbn10),
      pages: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
      language: info.language ?? null,
      genres: info.categories ?? [],
      summary: info.description ?? null,
      cover_url: coverOf(info.imageLinks),
    },
  };
};

/**
 * Ricerca su Google Books (API pubblica v1). La chiave è facoltativa ma, senza,
 * Google applica una quota condivisa per IP che si esaurisce presto.
 */
export const googleBooksSource = (
  options: { readonly apiKey?: string; readonly fetch?: typeof fetch } = {},
): SearchSource => ({
  id: "google_books",
  label: "Google Books",
  search: (query) => {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", toGoogleQuery(query));
    url.searchParams.set("maxResults", String(query.limit));
    url.searchParams.set("printType", "books");
    if (options.apiKey) url.searchParams.set("key", options.apiKey);

    return fetchJson(options.fetch ?? fetch, "Google Books")(url).andThen((body) => {
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) return errAsync(upstream(parsed.error.message));
      // Un volume malformato non deve far perdere gli altri risultati.
      const hits = (parsed.data.items ?? []).flatMap((item) => {
        const volume = volumeSchema.safeParse(item);
        const hit = volume.success ? toSearchHit(volume.data) : null;
        return hit ? [hit] : [];
      });
      return okAsync(hits);
    });
  },
});
