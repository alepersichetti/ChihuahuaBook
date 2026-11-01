import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { CustomColumn } from "../core/columns/column";
import type { ColumnStore } from "../core/columns/ports";
import type { Role } from "../core/auth/roles";
import { notFound } from "../core/errors";
import { columnsRoutes, type ColumnsApiDeps } from "./columns-api";
import { router } from "./router";

const bookId = "4b6f2d4e-5c1a-4f0e-9a7b-1c2d3e4f5a6b";

const unreachable = () => {
  throw new Error("non dovrebbe essere chiamato");
};

const stored = (key: string, overrides: Partial<CustomColumn> = {}): CustomColumn => ({
  key,
  label: key,
  kind: "text",
  catalog_field: null,
  extra_key: key,
  position: 0,
  created_at: "2026-11-01T10:00:00Z",
  ...overrides,
});

const store = (overrides: Partial<ColumnStore>): ColumnStore => ({
  list: unreachable,
  ensure: unreachable,
  remove: unreachable,
  setValue: unreachable,
  ...overrides,
});

const app = (columns: ColumnStore, role: Role = "librarian") =>
  router<ColumnsApiDeps>("/api", columnsRoutes, () => ({
    session: { viewer: () => okAsync({ userId: "user", role }) },
    columns,
  }));

const call = (handler: ReturnType<typeof app>, method: string, path: string, body?: unknown) =>
  handler(
    new Request(`http://localhost${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

describe("columns API", () => {
  it("il lettore vede le colonne", async () => {
    const response = await call(app(store({ list: () => okAsync([stored("premi")]) }), "reader"), "GET", "/api/columns");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ key: "premi" }]);
  });

  it("il lettore non crea, non elimina e non compila colonne", async () => {
    const handler = app(store({}), "reader");
    expect((await call(handler, "POST", "/api/columns", { columns: [{ key: "premi", label: "Premi" }] })).status).toBe(403);
    expect((await call(handler, "DELETE", "/api/columns/premi")).status).toBe(403);
    expect((await call(handler, "PUT", `/api/books/${bookId}/fields/premi`, { value: "Strega" })).status).toBe(403);
  });

  it("crea le colonne con i valori predefiniti, una sola volta per chiave", async () => {
    const ensure = vi.fn<ColumnStore["ensure"]>(() => okAsync([stored("premi")]));
    const response = await call(app(store({ ensure })), "POST", "/api/columns", {
      columns: [
        { key: "premi", label: " Premi " },
        { key: "premi", label: "Doppione" },
        { key: "traduttore", label: "Traduttore", catalog_field: "translators", extra_key: "translator" },
      ],
    });
    expect(response.status).toBe(200);
    expect(ensure).toHaveBeenCalledWith([
      { key: "premi", label: "Premi", kind: "text", catalog_field: null, extra_key: "premi" },
      // Una colonna del catalogo non legge da extra.
      { key: "traduttore", label: "Traduttore", kind: "text", catalog_field: "translators", extra_key: null },
    ]);
  });

  it("rifiuta chiavi non normalizzate e campi del catalogo sconosciuti", async () => {
    const handler = app(store({}));
    expect((await call(handler, "POST", "/api/columns", { columns: [{ key: "Premi Letterari", label: "x" }] })).status).toBe(400);
    expect((await call(handler, "POST", "/api/columns", { columns: [{ key: "x", label: "x", catalog_field: "title" }] })).status).toBe(400);
    expect((await call(handler, "POST", "/api/columns", { columns: [] })).status).toBe(400);
  });

  it("elimina una colonna", async () => {
    const remove = vi.fn<ColumnStore["remove"]>(() => okAsync(undefined));
    const response = await call(app(store({ remove })), "DELETE", "/api/columns/premi");
    expect(response.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("premi");
  });

  it("scrive il valore nella chiave di extra della colonna", async () => {
    const setValue = vi.fn<ColumnStore["setValue"]>(() => okAsync(undefined));
    const handler = app(store({ list: () => okAsync([stored("placepublished", { extra_key: "placePublished" })]), setValue }));
    const response = await call(handler, "PUT", `/api/books/${bookId}/fields/placepublished`, { value: " Italia " });
    expect(response.status).toBe(204);
    expect(setValue).toHaveBeenCalledWith(bookId, "placePublished", "Italia");
    await call(handler, "PUT", `/api/books/${bookId}/fields/placepublished`, { value: "  " });
    expect(setValue).toHaveBeenLastCalledWith(bookId, "placePublished", null);
  });

  it("non scrive in colonne che non esistono o che leggono il catalogo", async () => {
    const handler = app(
      store({ list: () => okAsync([stored("translators", { catalog_field: "translators", extra_key: null })]) }),
    );
    expect((await call(handler, "PUT", `/api/books/${bookId}/fields/premi`, { value: "x" })).status).toBe(404);
    expect((await call(handler, "PUT", `/api/books/${bookId}/fields/translators`, { value: "x" })).status).toBe(400);
    expect((await call(handler, "PUT", `/api/books/non-un-id/fields/translators`, { value: "x" })).status).toBe(400);
  });

  it("risponde 404 se il libro non c'è", async () => {
    const handler = app(store({ list: () => okAsync([stored("premi")]), setValue: () => errAsync(notFound) }));
    expect((await call(handler, "PUT", `/api/books/${bookId}/fields/premi`, { value: "x" })).status).toBe(404);
  });
});
