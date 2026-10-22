import { describe, expect, it, vi } from "vitest";
import { openLibrarySource } from "./search";

const fakeFetch = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const doc = {
  key: "/works/OL123W",
  title: "Il nome della rosa",
  author_name: ["Umberto Eco"],
  publisher: ["Bompiani", "Fabbri"],
  first_publish_year: 1980,
  isbn: ["9788845292613", "8845292614", "9780156001311"],
  number_of_pages_median: 503,
  subject: ["Fiction", "Monasteries"],
  language: ["ita"],
  cover_i: 42,
};

describe("openLibrarySource", () => {
  it("trasforma i risultati in bozze, con l'ISBN cercato", async () => {
    const fetchImpl = fakeFetch({ docs: [doc] });
    const result = await openLibrarySource({ fetch: fetchImpl }).search({
      field: "isbn",
      text: "9788845292613",
      limit: 5,
    });
    expect(result._unsafeUnwrap()).toEqual([
      {
        source: "open_library",
        sourceId: "/works/OL123W",
        link: "https://openlibrary.org/works/OL123W",
        draft: {
          title: "Il nome della rosa",
          subtitle: null,
          authors: ["Umberto Eco"],
          publisher: "Bompiani",
          published_year: 1980,
          isbn13: "9788845292613",
          isbn10: "8845292614",
          pages: 503,
          language: "ita",
          genres: ["Fiction", "Monasteries"],
          cover_url: "https://covers.openlibrary.org/b/id/42-L.jpg",
        },
      },
    ]);
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("q")).toBe("isbn:9788845292613");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("non indovina l'ISBN quando si cerca per titolo", async () => {
    const result = await openLibrarySource({ fetch: fakeFetch({ docs: [doc] }) }).search({
      field: "title",
      text: "nome della rosa",
      limit: 5,
    });
    expect(result._unsafeUnwrap()[0].draft).toMatchObject({ isbn13: null, isbn10: null });
  });

  it("segnala errori HTTP come upstream", async () => {
    const result = await openLibrarySource({ fetch: fakeFetch({}, 500) }).search({
      field: "any",
      text: "x",
      limit: 5,
    });
    expect(result._unsafeUnwrapErr().kind).toBe("upstream");
  });
});
