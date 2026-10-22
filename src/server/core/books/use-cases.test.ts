import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { notFound } from "../errors";
import type { Book } from "./book";
import type { BookStore } from "./ports";
import { createBook, inspectIsbn, listBooks, updateBook } from "./use-cases";

const id = "4b6f2d4e-5c1a-4f0e-9a7b-1c2d3e4f5a6b";

const stored = (fields: Partial<Book>): Book =>
  ({ id, title: "x", ...fields }) as Book;

const unreachable = () => {
  throw new Error("non dovrebbe essere chiamato");
};

describe("createBook", () => {
  it("valida, ricava l'ISBN mancante e salva", async () => {
    const insert = vi.fn((book) => okAsync(stored(book)));
    const result = await createBook({ insert })({
      title: "Il nome della rosa",
      isbn13: "978-88-452-9261-3",
    });
    expect(result.isOk()).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        isbn13: "9788845292613",
        isbn10: "8845292614",
      }),
    );
  });

  it("non tocca il magazzino se l'input non è valido", async () => {
    const result = await createBook({ insert: unreachable })({ title: "" });
    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: "validation",
      issues: [{ path: "title" }],
    });
  });
});

describe("updateBook", () => {
  it("rifiuta un id non valido", async () => {
    const result = await updateBook({ update: unreachable })("1", {
      rating: 3,
    });
    expect(result._unsafeUnwrapErr().kind).toBe("validation");
  });

  it("passa solo i campi inviati", async () => {
    const update = vi.fn((_id: string, patch) => okAsync(stored(patch)));
    await updateBook({ update })(id, { rating: 4 });
    expect(update).toHaveBeenCalledWith(id, { rating: 4 });
  });
});

describe("listBooks", () => {
  it("traduce la query string in una richiesta al magazzino", async () => {
    const list = vi.fn<BookStore["list"]>(() =>
      okAsync({ books: [], total: 0 }),
    );
    await listBooks({ list })({
      q: " Città ",
      status: "read",
      favorite: "true",
      sort: "title",
      limit: "10",
    });
    expect(list).toHaveBeenCalledWith({
      filter: {
        text: "Citta",
        readStatus: "read",
        tag: undefined,
        favorite: true,
        collectionId: undefined,
      },
      sort: "title",
      ascending: true,
      limit: 10,
      offset: 0,
    });
  });

  it("rifiuta parametri sconosciuti nei valori", async () => {
    const result = await listBooks({ list: unreachable })({ sort: "colore" });
    expect(result._unsafeUnwrapErr().kind).toBe("validation");
  });
});

describe("inspectIsbn", () => {
  it("unisce la bozza esterna e le copie già possedute", async () => {
    const report = await inspectIsbn(
      () => okAsync({ title: "Il nome della rosa" }),
      { findByIsbn13: () => okAsync([stored({ title: "Copia" })]) },
    )("8845292614");
    expect(report._unsafeUnwrap()).toMatchObject({
      isbn13: "9788845292613",
      isbn10: "8845292614",
      draft: { title: "Il nome della rosa", isbn13: "9788845292613" },
      owned: [{ title: "Copia" }],
    });
  });

  it("propaga gli errori delle porte", async () => {
    const report = await inspectIsbn(() => okAsync(null), {
      findByIsbn13: () => errAsync(notFound),
    })("9788845292613");
    expect(report._unsafeUnwrapErr()).toEqual(notFound);
  });

  it("rifiuta un ISBN non valido senza chiamare le porte", async () => {
    const report = await inspectIsbn(unreachable, {
      findByIsbn13: unreachable,
    })("123");
    expect(report._unsafeUnwrapErr().kind).toBe("validation");
  });
});
