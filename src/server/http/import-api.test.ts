import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "../core/books/book";
import type { BookStore, ImportStore } from "../core/books/ports";
import { unauthenticated } from "../core/errors";
import { importRoutes, type ImportApiDeps } from "./import-api";
import { router } from "./router";

const id = "4b6f2d4e-5c1a-4f0e-9a7b-1c2d3e4f5a6b";

const imports: ImportStore = {
  findBySource: () => okAsync([]),
  insertMany: (books) => okAsync(books.map((book) => ({ id, source_id: book.source_id }))),
  replace: () => okAsync(undefined),
};

const app = (deps: Partial<ImportApiDeps> = {}) =>
  router<ImportApiDeps>("/api", importRoutes, () => ({
    session: { userId: () => okAsync("user") },
    books: {
      get: () => okAsync({ id } as Book),
      update: (_id: string, patch: object) => okAsync({ id, ...patch } as Book),
    } as unknown as BookStore,
    imports,
    covers: { put: (path) => okAsync(path) },
    ...deps,
  }));

describe("import API", () => {
  it("importa un lotto e risponde con l'esito di ogni libro", async () => {
    const response = await app()(
      new Request("http://localhost/api/import/books", {
        method: "POST",
        body: JSON.stringify({ items: [{ source_id: "1", book: { title: "Dune" } }] }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: 1, items: [{ status: "created", id }] });
  });

  it("riceve la copertina come corpo binario", async () => {
    const put = vi.fn((...args: [string, Uint8Array, string]) => okAsync(args[0]));
    const response = await app({ covers: { put } })(
      new Request(`http://localhost/api/books/${id}/cover`, {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([137, 80, 78, 71]),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cover_path: `user/${id}.png` });
    expect(put.mock.calls[0][1]).toHaveLength(4);
  });

  it("risponde 401 senza sessione", async () => {
    const response = await app({ session: { userId: () => errAsync(unauthenticated) } })(
      new Request("http://localhost/api/import/books", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(401);
  });
});
