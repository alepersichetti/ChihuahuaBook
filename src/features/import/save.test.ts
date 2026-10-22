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
          status: item.source_id === "b" ? "skipped" : "created",
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
      onExisting: "skip",
      onProgress: () => {},
      fetch: fetcher as typeof fetch,
      prepareCover: async (blob) => blob,
    });
    expect(outcome).toMatchObject({ kind: "saved", created: 1, skipped: 1, coversUploaded: 1 });
    expect(calls).toEqual(["POST /api/import/books", "PUT /api/books/id-a/cover"]);
  });

  it("senza accesso si ferma e lo dice", async () => {
    const outcome = await saveImport({
      books: [book("a")],
      covers: new Map(),
      onExisting: "update",
      onProgress: () => {},
      fetch: (async () => json({ error: "unauthenticated" }, 401)) as typeof fetch,
    });
    expect(outcome).toMatchObject({ kind: "unavailable", reason: "unauthenticated" });
  });
});
