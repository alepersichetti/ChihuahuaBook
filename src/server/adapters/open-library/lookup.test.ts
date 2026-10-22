import { describe, expect, it, vi } from "vitest";
import { openLibraryLookup } from "./lookup";

const fakeFetch = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("openLibraryLookup", () => {
  it("trasforma la risposta di Open Library in una bozza", async () => {
    const fetchImpl = fakeFetch({
      "ISBN:9788845292613": {
        title: "Il nome della rosa",
        authors: [{ name: "Umberto Eco" }],
        publishers: [{ name: "Bompiani" }],
        publish_date: "Oct 2012",
        number_of_pages: 503,
        cover: { large: "https://covers.openlibrary.org/b/id/1-L.jpg" },
      },
    });

    const result = await openLibraryLookup(fetchImpl)("9788845292613");

    expect(result._unsafeUnwrap()).toEqual({
      title: "Il nome della rosa",
      subtitle: null,
      authors: ["Umberto Eco"],
      publisher: "Bompiani",
      published_year: 2012,
      pages: 503,
      genres: [],
      cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg",
    });
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("bibkeys")).toBe("ISBN:9788845292613");
  });

  it("restituisce null se il libro non esiste", async () => {
    const result = await openLibraryLookup(fakeFetch({}))("9788845292613");
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it("segnala errori HTTP come upstream", async () => {
    const result = await openLibraryLookup(fakeFetch({}, 503))("9788845292613");
    expect(result._unsafeUnwrapErr().kind).toBe("upstream");
  });
});
