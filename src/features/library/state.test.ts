import { describe, expect, it } from "vitest";
import { sampleLibrary } from "./sample-library";
import {
  currentColumns,
  currentView,
  initialState,
  libraryReducer,
  selectedBook,
  type LibraryAction,
} from "./state";

const run = (...actions: LibraryAction[]) =>
  actions.reduce(libraryReducer, initialState(sampleLibrary));

describe("libraryReducer", () => {
  it("parte dalla Libreria in vista lista con layout classico", () => {
    const state = run();
    expect(state.collectionId).toBe("library");
    expect(currentView(state)).toBe("list");
    expect(state.layout).toBe("classic");
  });

  it("ogni collezione ricorda la sua vista; una nuova eredita l'ultima", () => {
    const state = run(
      { type: "setView", view: "grid" },
      { type: "selectCollection", collectionId: "loaned" },
    );
    expect(currentView(state)).toBe("grid");
    const back = libraryReducer(
      libraryReducer(state, { type: "setView", view: "carousel" }),
      { type: "selectCollection", collectionId: "library" },
    );
    expect(currentView(back)).toBe("grid");
  });

  it("cambiare layout porta alla sua vista preferita", () => {
    expect(currentView(run({ type: "setLayout", layout: "gallery" }))).toBe("grid");
    expect(currentView(run({ type: "setLayout", layout: "shelf" }))).toBe("carousel");
  });

  it("non permette di togliere la colonna del titolo", () => {
    const state = run({ type: "toggleColumn", column: "title" });
    expect(currentColumns(state)).toContain("title");
  });

  it("presta e restituisce un libro senza toccare gli altri", () => {
    const loan = { borrower: "Anna", loanedOn: "2026-10-22", dueOn: null };
    const lent = run(
      { type: "selectBook", bookId: "nome-della-rosa" },
      { type: "lend", bookId: "nome-della-rosa", loan },
    );
    expect(selectedBook(lent)?.loan).toEqual(loan);
    const returned = libraryReducer(lent, { type: "returnBook", bookId: "nome-della-rosa" });
    expect(selectedBook(returned)?.loan).toBeNull();
    expect(returned.library.books.find((book) => book.id === "gattopardo")?.loan).not.toBeNull();
  });

  it("aprire un libro da telefono passa alla sua scheda", () => {
    const state = run({ type: "openBook", bookId: "gattopardo" });
    expect(state.mobileScreen).toBe("book");
    expect(state.selectedBookId).toBe("gattopardo");
  });
});
