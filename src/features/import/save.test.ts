import { describe, expect, it, vi } from "vitest";
import type { PediaBook } from "@/server/core/books/pedia";
import { saveImport } from "./save";

const book = (sourceId: string) =>
  ({ sourceId, book: { title: `Libro ${sourceId}` }, extra: {}, coverHints: [] }) as unknown as PediaBook;

const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("saveImport", () => {
  it("salva i libri a lotti e poi carica le copertine dei libri salvati", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method} ${url}`);
      if (String(url).endsWith("/cover")) return new Response(null, { status: 200 });
      const { items } = JSON.parse(String(init?.body));
      return json({
        items: items.map((item: { source_id: string }) => ({
          source_id: item.source_id,
          status: item.source_id === "b" ? "unchanged" : "created",
          id: `id-${item.source_id}`,
        })),
      });
    });
    const cover = { path: "1.jpg", blob: new Blob([new Uint8Array(3)], { type: "image/jpeg" }) };
    const outcome = await saveImport({
      books: [book("a"), book("b")],
      covers: new Map([
        ["a", cover],
        ["b", cover],
      ]),
      mode: "delta",
      onProgress: () => {},
      fetch: fetcher as typeof fetch,
      prepareCover: async (blob) => blob,
    });
    expect(outcome).toMatchObject({ kind: "saved", created: 1, unchanged: 1, removed: null, coversUploaded: 1 });
    expect(calls).toEqual(["POST /api/import/books", "PUT /api/books/id-a/cover"]);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).on_existing).toBe("changed");
  });

  it("senza accesso si ferma e lo dice", async () => {
    const outcome = await saveImport({
      books: [book("a")],
      covers: new Map(),
      mode: "delta",
      onProgress: () => {},
      fetch: (async () => json({ error: "unauthenticated" }, 401)) as typeof fetch,
    });
    expect(outcome).toMatchObject({ kind: "unavailable", reason: "unauthenticated" });
  });

  it("sostituendo, riscrive tutto e dopo i libri elimina quelli che non sono nel file", async () => {
    const bodies: { url: string; body: Record<string, unknown> }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push({ url: String(url), body });
      return String(url).endsWith("/prune")
        ? json({ dry_run: false, removed: 7, kept: 2 })
        : json({ items: body.items.map((item: { source_id: string }) => ({ ...item, status: "updated", id: "x" })) });
    });
    const outcome = await saveImport({
      books: [book("a"), book("b")],
      covers: new Map(),
      mode: "replace",
      onProgress: () => {},
      fetch: fetcher as typeof fetch,
    });
    expect(outcome).toMatchObject({ kind: "saved", updated: 2, removed: 7 });
    expect(bodies.map(({ url }) => url)).toEqual(["/api/import/books", "/api/import/prune"]);
    expect(bodies[0].body.on_existing).toBe("update");
    expect(bodies[1].body).toEqual({ source: "bookpedia", keep_source_ids: ["a", "b"], dry_run: false });
  });
});
