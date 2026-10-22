import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "./book";
import { importBooks, setBookCover } from "./import";
import type { ImportedBook, ImportStore } from "./ports";

const fakeStore = (existing: Record<string, string> = {}) => {
  const inserted: ImportedBook[] = [];
  const replaced: [string, ImportedBook][] = [];
  const store: ImportStore = {
    findBySource: (_source, ids) =>
      okAsync(ids.filter((id) => existing[id]).map((id) => ({ id: existing[id], source_id: id }))),
    insertMany: (books) => {
      inserted.push(...books);
      return okAsync(books.map((book) => ({ id: `new-${book.source_id}`, source_id: book.source_id })));
    },
    replace: (id, book) => {
      replaced.push([id, book]);
      return okAsync(undefined);
    },
  };
  return { store, inserted, replaced };
};

const item = (source_id: string, title = `Libro ${source_id}`) => ({ source_id, book: { title } });

describe("importBooks", () => {
  it("crea i nuovi e aggiorna quelli già importati, senza doppioni", async () => {
    const { store, inserted, replaced } = fakeStore({ b: "old-b" });
    const report = (await importBooks(store)({ items: [item("a"), item("b")] }))._unsafeUnwrap();
    expect(report).toMatchObject({ created: 1, updated: 1, skipped: 0, failed: 0 });
    expect(report.items.map((entry) => entry.status)).toEqual(["created", "updated"]);
    expect(inserted).toMatchObject([{ source: "bookpedia", source_id: "a", title: "Libro a" }]);
    expect(replaced).toMatchObject([["old-b", { source_id: "b" }]]);
  });

  it("con on_existing=skip lascia stare i libri già presenti", async () => {
    const { store, replaced } = fakeStore({ b: "old-b" });
    const report = (
      await importBooks(store)({ on_existing: "skip", items: [item("b")] })
    )._unsafeUnwrap();
    expect(report).toMatchObject({ skipped: 1, items: [{ status: "skipped", id: "old-b" }] });
    expect(replaced).toEqual([]);
  });

  it("una scheda non valida o ripetuta fallisce da sola", async () => {
    const { store } = fakeStore();
    const report = (
      await importBooks(store)({ items: [item("a"), item("x", ""), item("a")] })
    )._unsafeUnwrap();
    expect(report.items.map((entry) => entry.status)).toEqual(["created", "failed", "failed"]);
  });

  it("un errore del magazzino diventa l'esito dei libri coinvolti", async () => {
    const { store } = fakeStore();
    const failing: ImportStore = {
      ...store,
      insertMany: () => errAsync({ kind: "unexpected", message: "db giù" }),
    };
    const report = (await importBooks(failing)({ items: [item("a")] }))._unsafeUnwrap();
    expect(report.items).toEqual([
      { source_id: "a", status: "failed", issues: [{ path: "", message: "db giù" }] },
    ]);
  });

  it("rifiuta un lotto vuoto", async () => {
    const result = await importBooks(fakeStore().store)({ items: [] });
    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "validation" });
  });
});

describe("setBookCover", () => {
  const id = "4b6f2d4e-5c1a-4f0e-9a7b-1c2d3e4f5a6b";
  const books = {
    get: () => okAsync({ id } as Book),
    update: vi.fn((_id: string, patch: object) => okAsync({ id, ...patch } as Book)),
  };

  it("salva in <libro>.<ext> e collega il percorso al libro", async () => {
    const put = vi.fn((path: string) => okAsync(path));
    const book = (
      await setBookCover(books, { put })(id, "image/jpeg", new Uint8Array([1, 2]))
    )._unsafeUnwrap();
    expect(put).toHaveBeenCalledWith(`${id}.jpg`, expect.any(Uint8Array), "image/jpeg");
    expect(book.cover_path).toBe(`${id}.jpg`);
  });

  it("rifiuta formati non ammessi dal bucket", async () => {
    const result = await setBookCover(books, { put: vi.fn() })(id, "image/tiff", new Uint8Array([1]));
    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "validation" });
  });
});
