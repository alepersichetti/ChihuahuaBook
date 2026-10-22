import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "./book";
import { booksToPrune, contentHash, importBooks, pruneLibrary, setBookCover } from "./import";
import type { CatalogEntry, ImportedBook, ImportStore } from "./ports";

const fakeStore = (existing: Record<string, string> = {}, hashes: Record<string, string> = {}) => {
  const inserted: ImportedBook[] = [];
  const replaced: [string, ImportedBook][] = [];
  const store: ImportStore = {
    findBySource: (_source, ids) =>
      okAsync(
        ids
          .filter((id) => existing[id])
          .map((id) => ({ id: existing[id], source_id: id, import_hash: hashes[id] ?? null })),
      ),
    insertMany: (books) => {
      inserted.push(...books);
      return okAsync(
        books.map((book) => ({ id: `new-${book.source_id}`, source_id: book.source_id, import_hash: book.import_hash })),
      );
    },
    replace: (id, book) => {
      replaced.push([id, book]);
      return okAsync(undefined);
    },
    listAll: () => okAsync([]),
    removeMany: () => okAsync(undefined),
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

  it("con on_existing=changed riscrive solo i libri la cui scheda è cambiata", async () => {
    const first = fakeStore();
    await importBooks(first.store)({ items: [item("a"), item("b")] });
    const hashes = Object.fromEntries(first.inserted.map((book) => [book.source_id, book.import_hash]));
    const { store, replaced } = fakeStore({ a: "id-a", b: "id-b" }, hashes);
    const report = (
      await importBooks(store)({ on_existing: "changed", items: [item("a"), item("b", "Titolo nuovo")] })
    )._unsafeUnwrap();
    expect(report).toMatchObject({ updated: 1, unchanged: 1 });
    expect(report.items.map((entry) => entry.status)).toEqual(["unchanged", "updated"]);
    expect(replaced.map(([id]) => id)).toEqual(["id-b"]);
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

describe("contentHash", () => {
  it("non dipende dall'ordine delle chiavi", () => {
    expect(contentHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(contentHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});

describe("pruneLibrary", () => {
  const entry = (id: string, source: string | null, source_id: string | null, cover_path: string | null = null): CatalogEntry => ({
    id,
    source,
    source_id,
    cover_path,
  });
  const catalog = [
    entry("1", "bookpedia", "a", "1.jpg"),
    entry("2", "bookpedia", "b"),
    entry("3", null, null, "3.png"),
    entry("4", "bookpedia", "z", "4.jpg"),
  ];

  it("tiene solo i libri del file, compresi quelli importati in passato con lo stesso id", () => {
    expect(booksToPrune(catalog, "bookpedia", new Set(["a", "b"])).map((book) => book.id)).toEqual(["3", "4"]);
  });

  it("senza dry_run:false conta soltanto e non elimina nulla", async () => {
    const removeMany = vi.fn(() => okAsync(undefined));
    const report = (
      await pruneLibrary({ listAll: () => okAsync(catalog), removeMany }, { remove: vi.fn() })({ keep_source_ids: ["a"] })
    )._unsafeUnwrap();
    expect(report).toEqual({ dry_run: true, removed: 3, kept: 1 });
    expect(removeMany).not.toHaveBeenCalled();
  });

  it("con dry_run:false elimina i libri e le loro copertine", async () => {
    const removeMany = vi.fn<(ids: readonly string[]) => ReturnType<ImportStore["removeMany"]>>(() => okAsync(undefined));
    const remove = vi.fn<(paths: readonly string[]) => ReturnType<ImportStore["removeMany"]>>(() => okAsync(undefined));
    const report = (
      await pruneLibrary({ listAll: () => okAsync(catalog), removeMany }, { remove })({
        keep_source_ids: ["a", "b"],
        dry_run: false,
      })
    )._unsafeUnwrap();
    expect(report).toEqual({ dry_run: false, removed: 2, kept: 2 });
    expect(removeMany).toHaveBeenCalledWith(["3", "4"]);
    expect(remove).toHaveBeenCalledWith(["3.png", "4.jpg"]);
  });

  it("rifiuta un elenco vuoto, che cancellerebbe tutta la biblioteca", async () => {
    const result = await pruneLibrary({ listAll: vi.fn(), removeMany: vi.fn() }, { remove: vi.fn() })({ keep_source_ids: [] });
    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "validation" });
  });
});
