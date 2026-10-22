import { describe, expect, it, vi } from "vitest";
import { defaultSources, loadSources, saveBook, searchOnline, uploadCover } from "./api";

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("api aggiunta libro", () => {
  it("usa le fonti predefinite se il server non risponde", async () => {
    expect(await loadSources({ fetch: reply({ error: "unauthenticated" }, 401) })).toEqual(defaultSources);
    expect(await loadSources({ fetch: reply([{ id: "open_library", label: "Open Library" }]) })).toEqual([
      { id: "open_library", label: "Open Library" },
    ]);
  });

  it("traduce gli errori della ricerca in codici", async () => {
    const search = (status: number, body: unknown) =>
      searchOnline({ source: "google_books", field: "title", text: "Dune" }, { fetch: reply(body, status) });
    expect(await search(502, { error: "upstream" })).toEqual({ ok: false, error: { kind: "upstream" } });
    expect(await search(403, { error: "forbidden" })).toEqual({ ok: false, error: { kind: "forbidden" } });
    expect(await search(500, { error: "unexpected" })).toEqual({ ok: false, error: { kind: "server", status: 500 } });
  });

  it("salva sul server o, senza accesso, solo in locale", async () => {
    expect(await saveBook({ title: "Dune" } as never, { fetch: reply({ id: "b1" }, 201) })).toEqual({
      kind: "saved",
      id: "b1",
    });
    expect((await saveBook({ title: "Dune" } as never, { fetch: reply({}, 401) })).kind).toBe("local");
    expect((await saveBook({ title: "Dune" } as never, { fetch: reply({ error: "misconfigured" }, 500) })).kind).toBe("local");
    expect((await saveBook({ title: "" } as never, { fetch: reply({ error: "validation" }, 400) })).kind).toBe("failed");
    expect((await saveBook({ title: "Dune" } as never, { fetch: reply({}, 403) })).kind).toBe("failed");
  });
});

describe("uploadCover", () => {
  it("manda l'immagine con il suo tipo", async () => {
    const fetchImpl = reply({}, 200);
    const image = new Blob(["x"], { type: "image/png" });
    expect(await uploadCover("b1", image, { fetch: fetchImpl })).toMatchObject({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/books/b1/cover");
    expect(init).toMatchObject({ method: "PUT", headers: { "content-type": "image/png" } });
  });
});
