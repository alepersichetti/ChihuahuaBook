import { errAsync, okAsync } from "neverthrow";
import { z } from "zod";
import { parseIsbn } from "../../core/books/isbn";
import type { SearchHit, SearchSource } from "../../core/books/ports";
import type { BookSearchQuery } from "../../core/books/search";
import { fetchJson, upstream } from "../http";

const docSchema = z.object({
  key: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  author_name: z.array(z.string()).optional(),
  publisher: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  isbn: z.array(z.string()).optional(),
  number_of_pages_median: z.number().optional(),
  subject: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
});

const responseSchema = z.object({ docs: z.array(z.unknown()) });

type Doc = z.infer<typeof docSchema>;

export const openLibraryUrl = "https://openlibrary.org/";

const fields = Object.keys(docSchema.shape).join(",");

const applyQuery = (url: URL, { field, text }: BookSearchQuery) => {
  switch (field) {
    case "isbn":
      return url.searchParams.set("q", `isbn:${text}`);
    case "title":
      return url.searchParams.set("title", text);
    case "author":
      return url.searchParams.set("author", text);
    case "any":
      return url.searchParams.set("q", text);
  }
};

// Open Library raggruppa le edizioni in un'opera: l'ISBN è affidabile solo
// se lo si è cercato, altrimenti potrebbe essere di un'altra edizione.
export const toSearchHit =
  (query: BookSearchQuery) =>
  (doc: Doc): SearchHit | null => {
    if (!doc.title?.trim()) return null;
    const isbn =
      query.field === "isbn" && doc.isbn?.some((value) => parseIsbn(value)?.isbn13 === query.text)
        ? parseIsbn(query.text)
        : null;
    return {
      source: "open_library",
      sourceId: doc.key,
      link: `https://openlibrary.org${doc.key}`,
      draft: {
        title: doc.title,
        subtitle: doc.subtitle ?? null,
        authors: doc.author_name ?? [],
        publisher: doc.publisher?.[0] ?? null,
        published_year: doc.first_publish_year ?? null,
        isbn13: isbn?.isbn13 ?? null,
        isbn10: isbn?.isbn10 ?? null,
        pages: doc.number_of_pages_median ?? null,
        language: doc.language?.length === 1 ? doc.language[0] : null,
        genres: doc.subject?.slice(0, 5) ?? [],
        cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      },
    };
  };

/** Ricerca su Open Library (search.json): gratuita e senza chiave. */
export const openLibrarySource = (
  options: { readonly fetch?: typeof fetch; readonly baseUrl?: string } = {},
): SearchSource => ({
  id: "open_library",
  label: "Open Library",
  search: (query) => {
    const url = new URL("search.json", options.baseUrl ?? openLibraryUrl);
    applyQuery(url, query);
    url.searchParams.set("limit", String(query.limit));
    url.searchParams.set("fields", fields);

    return fetchJson(options.fetch ?? fetch, "Open Library")(url).andThen((body) => {
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) return errAsync(upstream(parsed.error.message));
      const hits = parsed.data.docs.flatMap((item) => {
        const doc = docSchema.safeParse(item);
        const hit = doc.success ? toSearchHit(query)(doc.data) : null;
        return hit ? [hit] : [];
      });
      return okAsync(hits);
    });
  },
});
