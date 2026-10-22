import { describe, expect, it, vi } from "vitest";
import { explainGoogleError, googleBooksSource, toGoogleQuery } from "./search";

const fakeFetch = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const volume = {
  id: "abc123",
  volumeInfo: {
    title: "Il nome della rosa",
    authors: ["Umberto Eco"],
    publisher: "Bompiani",
    publishedDate: "2012-10-03",
    description: "Un giallo in un'abbazia.",
    industryIdentifiers: [
      { type: "ISBN_10", identifier: "8845292614" },
      { type: "ISBN_13", identifier: "9788845292613" },
    ],
    pageCount: 503,
    categories: ["Fiction"],
    language: "it",
    imageLinks: { thumbnail: "http://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=1&edge=curl" },
    canonicalVolumeLink: "https://books.google.com/books/about/?id=abc123",
  },
};

const search = (fetchImpl: typeof fetch, apiKey?: string) =>
  googleBooksSource({ fetch: fetchImpl, apiKey }).search({ field: "isbn", text: "9788845292613", limit: 10 });

describe("googleBooksSource", () => {
  it("trasforma i volumi in bozze", async () => {
    const fetchImpl = fakeFetch({ items: [volume] });
    const hits = (await search(fetchImpl, "chiave"))._unsafeUnwrap();
    expect(hits).toEqual([
      {
        source: "google_books",
        sourceId: "abc123",
        link: "https://books.google.com/books/about/?id=abc123",
        draft: {
          title: "Il nome della rosa",
          subtitle: null,
          authors: ["Umberto Eco"],
          publisher: "Bompiani",
          published_year: 2012,
          isbn13: "9788845292613",
          isbn10: "8845292614",
          pages: 503,
          language: "it",
          genres: ["Fiction"],
          summary: "Un giallo in un'abbazia.",
          cover_url: "https://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=1",
        },
      },
    ]);
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("q")).toBe("isbn:9788845292613");
    expect(url.searchParams.get("key")).toBe("chiave");
  });

  it("restituisce una lista vuota se non trova nulla e scarta i volumi senza titolo", async () => {
    expect((await search(fakeFetch({ totalItems: 0 })))._unsafeUnwrap()).toEqual([]);
    const broken = { id: "x", volumeInfo: {} };
    expect((await search(fakeFetch({ items: [broken, volume] })))._unsafeUnwrap()).toHaveLength(1);
  });

  it("segnala errori HTTP come upstream", async () => {
    expect((await search(fakeFetch({}, 429)))._unsafeUnwrapErr().kind).toBe("upstream");
  });

  it("spiega perché Google rifiuta la ricerca", async () => {
    const quota = { error: { code: 429, errors: [{ reason: "rateLimitExceeded" }], details: [{ reason: "RATE_LIMIT_EXCEEDED" }] } };
    expect((await search(fakeFetch(quota, 429)))._unsafeUnwrapErr()).toMatchObject({ kind: "upstream", reason: "key_missing" });
    expect((await search(fakeFetch(quota, 429), "chiave"))._unsafeUnwrapErr()).toMatchObject({ reason: "quota" });

    const explain = explainGoogleError(true);
    expect(explain(400, { error: { message: "API key not valid. Please pass a valid API key.", details: [{ reason: "API_KEY_INVALID" }] } })).toBe("key_invalid");
    expect(explain(403, { error: { details: [{ reason: "API_KEY_HTTP_REFERRER_BLOCKED" }] } })).toBe("key_restricted");
    expect(explain(403, { error: { errors: [{ reason: "accessNotConfigured" }] } })).toBe("api_disabled");
    expect(explain(500, "non json")).toBeUndefined();
  });

  it("manda l'indirizzo dell'app come referrer, per le chiavi limitate ai siti web", async () => {
    const fetchImpl = fakeFetch({ items: [] });
    await googleBooksSource({ fetch: fetchImpl, apiKey: "chiave", referer: "https://libri.example/" }).search({ field: "any", text: "rosa", limit: 5 });
    const init = (fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(new Headers(init.headers).get("referer")).toBe("https://libri.example/");
  });

  it("usa la radice dell'API indicata, per esempio un finto server nei test e2e", async () => {
    const fetchImpl = fakeFetch({ items: [] });
    await googleBooksSource({ fetch: fetchImpl, baseUrl: "http://127.0.0.1:4010/google/" }).search({ field: "any", text: "rosa", limit: 5 });
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(`${url.origin}${url.pathname}`).toBe("http://127.0.0.1:4010/google/books/v1/volumes");
  });

  it("usa la sintassi di Google per i campi", () => {
    expect(toGoogleQuery({ field: "title", text: "Dune", limit: 1 })).toBe("intitle:Dune");
    expect(toGoogleQuery({ field: "author", text: "Eco", limit: 1 })).toBe("inauthor:Eco");
    expect(toGoogleQuery({ field: "any", text: "rosa", limit: 1 })).toBe("rosa");
  });
});
