import { errAsync, okAsync } from "neverthrow";
import { z } from "zod";
import { cleanIsbn, isValidIsbn10, isValidIsbn13 } from "../../core/books/isbn";
import type { SearchHit, SearchSource } from "../../core/books/ports";
import type { UpstreamReason } from "../../core/errors";
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

const errorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    errors: z.array(z.object({ reason: z.string().optional() })).optional(),
    details: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});

/**
 * Traduce gli errori di Google in un motivo che l'utente può risolvere:
 * chiave assente o sbagliata, chiave limitata ai siti web, API non abilitata, quota.
 */
export const explainGoogleError =
  (hasKey: boolean) =>
  (status: number, body: unknown): UpstreamReason | undefined => {
    const parsed = errorSchema.safeParse(body);
    const reasons = parsed.success
      ? [...(parsed.data.error.errors ?? []), ...(parsed.data.error.details ?? [])].flatMap((item) =>
          item.reason ? [item.reason] : [],
        )
      : [];
    const message = parsed.success ? (parsed.data.error.message ?? "") : "";
    const has = (...names: readonly string[]) => reasons.some((reason) => names.includes(reason));

    if (has("API_KEY_INVALID", "keyInvalid") || /API key not valid/i.test(message)) return "key_invalid";
    if (has("API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "API_KEY_SERVICE_BLOCKED", "ipRefererBlocked"))
      return "key_restricted";
    if (has("SERVICE_DISABLED", "accessNotConfigured")) return "api_disabled";
    if (status === 429 || has("RATE_LIMIT_EXCEEDED", "rateLimitExceeded", "dailyLimitExceeded"))
      return hasKey ? "quota" : "key_missing";
    return undefined;
  };

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
 * Ricerca su Google Books (API pubblica v1). Senza chiave Google risponde con una
 * quota pari a zero, quindi in pratica la chiave serve sempre.
 */
export const googleBooksSource = (
  options: {
    readonly apiKey?: string;
    readonly fetch?: typeof fetch;
    /** Indirizzo dell'app: serve se la chiave è limitata ai siti web (referrer HTTP). */
    readonly referer?: string;
  } = {},
): SearchSource => ({
  id: "google_books",
  label: "Google Books",
  search: (query) => {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", toGoogleQuery(query));
    url.searchParams.set("maxResults", String(query.limit));
    url.searchParams.set("printType", "books");
    if (options.apiKey) url.searchParams.set("key", options.apiKey);

    return fetchJson(options.fetch ?? fetch, "Google Books", {
      headers: options.referer ? { Referer: options.referer } : {},
      explain: explainGoogleError(Boolean(options.apiKey)),
    })(url).andThen((body) => {
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
