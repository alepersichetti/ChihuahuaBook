import { describe, expect, it } from "vitest";
import type { Catalog, CatalogBook } from "@/server/core/library/catalog";
import { libraryFromCatalog, withDetails } from "./catalog";
import { initialState, libraryReducer } from "./state";

const row = (fields: Partial<CatalogBook> & Pick<CatalogBook, "id" | "title">): CatalogBook => ({
  source: null,
  source_id: null,
  subtitle: null,
  authors: [],
  publisher: null,
  published_year: null,
  isbn13: null,
  pages: null,
  format: null,
  language: null,
  genres: [],
  series: null,
  series_number: null,
  cover_path: null,
  cover_url: null,
  read_status: "unread",
  rating: null,
  favorite: false,
  tags: [],
  location: null,
  date_added: null,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  ...fields,
});

const catalog: Catalog = {
  books: [
    row({
      id: "b1",
      title: "Dune",
      source: "bookpedia",
      source_id: "42",
      cover_path: "b1.jpg",
      series_number: 2.5,
      date_added: "2008-07-13T20:16:29",
    }),
    row({ id: "b2", title: "Solaris", cover_url: "https://example.org/solaris.jpg" }),
  ],
  collections: [{ id: "c1", name: "Fantascienza", position: 0 }],
  memberships: [
    { collection_id: "c1", book_id: "b1" },
    { collection_id: "c1", book_id: "b2" },
  ],
  loans: [{ book_id: "b2", borrower: "Anna", loaned_on: "2026-10-01", due_on: null }],
};

describe("libraryFromCatalog", () => {
  const library = libraryFromCatalog(catalog);
  const [dune, solaris] = library.books;

  it("porta i libri nel modello della UI, senza trama e note ancora", () => {
    expect(dune).toMatchObject({
      id: "b1",
      title: "Dune",
      seriesNumber: 2.5,
      summary: null,
      notes: null,
      detailsPending: true,
      importKey: "bookpedia:42",
    });
    expect(solaris.importKey).toBeUndefined();
  });

  it("la data d'aggiunta di Bookpedia vince su quella dell'import", () => {
    expect(dune.addedAt.slice(0, 10)).toBe("2008-07-13");
    expect(solaris.addedAt).toBe("2026-11-01T10:00:00.000Z");
  });

  it("le copertine salvate passano dal server, quelle esterne restano link", () => {
    expect(dune.coverUrl).toBe("/api/books/b1/cover?v=2026-11-01T10%3A00%3A00.000Z");
    expect(solaris.coverUrl).toBe("https://example.org/solaris.jpg");
  });

  it("prestiti aperti, collezioni di sistema e collezioni con i loro libri", () => {
    expect(solaris.loan).toEqual({ borrower: "Anna", loanedOn: "2026-10-01", dueOn: null });
    expect(dune.loan).toBeNull();
    expect(library.collections.map((item) => item.id)).toEqual(["library", "loaned", "wishlist", "c1"]);
    expect(library.collections[3]).toMatchObject({ kind: "regular", bookIds: ["b1", "b2"], excluded: false });
  });

  it("trama e note arrivate completano il libro", () => {
    expect(withDetails(dune, { summary: "Arrakis", notes: null })).toMatchObject({
      summary: "Arrakis",
      detailsPending: false,
    });
  });
});

describe("biblioteca dal server nello stato", () => {
  const library = libraryFromCatalog(catalog);

  it("le trame arrivate entrano nel libro giusto", () => {
    const state = libraryReducer(initialState(library), { type: "bookDetails", bookId: "b1", summary: "Arrakis", notes: "Prima edizione" });
    expect(state.library.books[0]).toMatchObject({ summary: "Arrakis", notes: "Prima edizione", detailsPending: false });
    expect(state.library.books[1]).toBe(library.books[1]);
  });

  it("una biblioteca riletta tiene collezione e libro scelti, se esistono ancora", () => {
    const start = { ...initialState(library), collectionId: "c1", selectedBookId: "b2" };
    const kept = libraryReducer(start, { type: "loadLibrary", library });
    expect(kept).toMatchObject({ collectionId: "c1", selectedBookId: "b2" });
    const empty = libraryFromCatalog({ books: [], collections: [], memberships: [], loans: [] });
    expect(libraryReducer(start, { type: "loadLibrary", library: empty })).toMatchObject({
      collectionId: "library",
      selectedBookId: null,
    });
  });

  it("reimportare un libro già nel database non lo raddoppia", () => {
    const imported = { ...library.books[0], id: "bookpedia:42", importKey: undefined };
    const state = libraryReducer(initialState(library), {
      type: "importBooks",
      books: [imported],
      collectionName: "Bookpedia",
      replace: false,
    });
    expect(state.library.books.map((book) => book.id).toSorted()).toEqual(["b2", "bookpedia:42"]);
  });
});
