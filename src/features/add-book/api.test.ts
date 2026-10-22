import { describe, expect, it, vi } from "vitest";
import { defaultSources, loadSources, saveBook, searchOnline } from "./api";

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("api aggiunta libro", () => {
  it("usa le fonti predefinite se il server non risponde", async () => {
    expect(await loadSources({ fetch: reply({ error: "unauthenticated" }, 401) })).toEqual(defaultSources);
    expect(await loadSources({ fetch: reply([{ id: "open_library", label: "Open Library" }]) })).toEqual([
      { id: "open_library", label: "Open Library" },
    ]);
  });

  it("traduce gli errori della ricerca in messaggi", async () => {
    const result = await searchOnline(
      { source: "google_books", field: "title", text: "Dune" },
      { fetch: reply({ error: "upstream" }, 502) },
    );
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("quota") });
  });

  it("salva sul server o, senza accesso, solo in locale", async () => {
    expect(await saveBook({ title: "Dune" } as never, { fetch: reply({ id: "b1" }, 201) })).toEqual({
      kind: "saved",
      id: "b1",
    });
    expect((await saveBook({ title: "Dune" } as never, { fetch: reply({}, 401) })).kind).toBe("local");
    expect((await saveBook({ title: "" } as never, { fetch: reply({ error: "validation", issues: [{ message: "no" }] }, 400) })).kind).toBe(
      "failed",
    );
  });
});
