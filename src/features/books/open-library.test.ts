import { describe, expect, it, vi } from "vitest";
import { lookupIsbn } from "./open-library";

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("lookupIsbn", () => {
  it("trasforma la risposta di Open Library in una bozza di libro", async () => {
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

    const result = await lookupIsbn("88-452-9261-4", fetchImpl);

    expect(result._unsafeUnwrap()).toEqual({
      title: "Il nome della rosa",
      subtitle: null,
      authors: ["Umberto Eco"],
      publisher: "Bompiani",
      published_year: 2012,
      pages: 503,
      genres: [],
      cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg",
      isbn13: "9788845292613",
      isbn10: "8845292614",
    });
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("bibkeys")).toBe("ISBN:9788845292613");
  });

  it("restituisce null se il libro non esiste", async () => {
    const result = await lookupIsbn("9788845292613", fakeFetch({}));
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it("segnala ISBN non valido senza chiamare la rete", async () => {
    const fetchImpl = fakeFetch({});
    const result = await lookupIsbn("123", fetchImpl);
    expect(result._unsafeUnwrapErr()).toEqual({ kind: "invalid_isbn" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("segnala errori HTTP", async () => {
    const result = await lookupIsbn("9788845292613", fakeFetch({}, 503));
    expect(result._unsafeUnwrapErr().kind).toBe("network");
  });
});
