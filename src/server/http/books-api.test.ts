import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type { Book } from "../core/books/book";
import type { BookStore } from "../core/books/ports";
import { forbidden, unauthenticated } from "../core/errors";
import { booksRoutes, type BooksApiDeps } from "./books-api";
import { router } from "./router";

const id = "4b6f2d4e-5c1a-4f0e-9a7b-1c2d3e4f5a6b";

const unreachable = () => {
  throw new Error("non dovrebbe essere chiamato");
};

const store = (overrides: Partial<BookStore>): BookStore => ({
  list: unreachable,
  get: unreachable,
  findByIsbn13: unreachable,
  insert: unreachable,
  update: unreachable,
  remove: unreachable,
  ...overrides,
});

const app = (deps: Partial<BooksApiDeps>) =>
  router<BooksApiDeps>("/api", booksRoutes, () => ({
    session: { viewer: () => okAsync({ userId: "user", role: "librarian" }) },
    books: store({}),
    lookupIsbn: unreachable,
    searchSources: [],
    ...deps,
  }));

const call = (
  handler: ReturnType<typeof app>,
  method: string,
  path: string,
  body?: unknown,
) =>
  handler(
    new Request(`http://localhost${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

describe("books API", () => {
  it("crea un libro e risponde 201", async () => {
    const handler = app({
      books: store({ insert: (book) => okAsync({ ...book, id } as Book) }),
    });
    const response = await call(handler, "POST", "/api/books", {
      title: "Dune",
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id, title: "Dune" });
  });

  it("risponde 400 con i dettagli se la validazione fallisce", async () => {
    const response = await call(app({}), "POST", "/api/books", { title: "" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "validation",
      issues: [{ path: "title" }],
    });
  });

  it("risponde 400 se il corpo non è JSON", async () => {
    const response = await app({})(
      new Request("http://localhost/api/books", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
  });

  it("risponde 401 senza sessione e non tocca il magazzino", async () => {
    const response = await call(
      app({ session: { viewer: () => errAsync(unauthenticated) } }),
      "GET",
      `/api/books/${id}`,
    );
    expect(response.status).toBe(401);
  });

  it("il lettore legge ma non modifica", async () => {
    const asReader = (books: Partial<BookStore>) =>
      app({
        session: { viewer: () => okAsync({ userId: "user", role: "reader" }) },
        books: store(books),
      });
    const read = await call(asReader({ get: () => okAsync({ id } as Book) }), "GET", `/api/books/${id}`);
    expect(read.status).toBe(200);
    for (const [method, path] of [
      ["POST", "/api/books"],
      ["PATCH", `/api/books/${id}`],
      ["DELETE", `/api/books/${id}`],
    ] as const) {
      const response = await call(asReader({}), method, path, { title: "x" });
      expect(response.status).toBe(403);
    }
  });

  it("risponde 403 a chi non è un membro attivo", async () => {
    const response = await call(
      app({ session: { viewer: () => errAsync(forbidden) } }),
      "GET",
      "/api/books",
    );
    expect(response.status).toBe(403);
  });

  it("risponde 404 se il libro non esiste", async () => {
    const handler = app({
      books: store({ get: () => errAsync({ kind: "not_found" }) }),
    });
    expect((await call(handler, "GET", `/api/books/${id}`)).status).toBe(404);
  });

  it("risponde 204 alla cancellazione", async () => {
    const handler = app({ books: store({ remove: () => okAsync(undefined) }) });
    const response = await call(handler, "DELETE", `/api/books/${id}`);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("distingue rotta inesistente e metodo non ammesso", async () => {
    expect((await call(app({}), "GET", "/api/nulla")).status).toBe(404);
    expect((await call(app({}), "PATCH", "/api/books")).status).toBe(405);
    expect((await call(app({}), "GET", "/altro/books")).status).toBe(404);
  });

  it("cerca nella fonte scelta e elenca le fonti", async () => {
    const searchSources = [
      {
        id: "fake",
        label: "Finta",
        search: (query: { text: string }) =>
          okAsync([
            {
              source: "fake",
              sourceId: "1",
              link: null,
              draft: { title: query.text },
            },
          ]),
      },
    ];
    const handler = app({ searchSources });

    const sources = await call(handler, "GET", "/api/search/sources");
    expect(await sources.json()).toEqual([{ id: "fake", label: "Finta" }]);

    const hits = await call(handler, "GET", "/api/search?source=fake&q=Dune");
    expect(hits.status).toBe(200);
    expect(await hits.json()).toMatchObject([{ draft: { title: "Dune" } }]);

    const missing = await call(handler, "GET", "/api/search?source=altro&q=x");
    expect(missing.status).toBe(400);
  });
});
