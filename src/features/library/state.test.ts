import { describe, expect, it } from "vitest";
import { sampleLibrary } from "./sample-library";
import {
  currentColumns,
  currentView,
  importCollectionId,
  initialState,
  libraryReducer,
  reducerFor,
  selectedBook,
  type LibraryAction,
} from "./state";

const run = (...actions: LibraryAction[]) =>
  actions.reduce(libraryReducer, initialState(sampleLibrary));

describe("libraryReducer", () => {
  it("parte dalla Libreria in vista lista", () => {
    const state = run();
    expect(state.collectionId).toBe("library");
    expect(currentView(state)).toBe("list");
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

describe("importBooks", () => {
  const imported = (id: string, title: string) => ({ ...sampleLibrary.books[0], id, title });

  it("aggiunge i libri e una collezione col nome del file, senza doppioni al reimport", () => {
    const once = libraryReducer(initialState(sampleLibrary), {
      type: "importBooks",
      collectionName: "Libri",
      books: [imported("bookpedia:1", "Dune")],
      replace: false,
    });
    const twice = libraryReducer(once, {
      type: "importBooks",
      collectionName: "Libri",
      books: [imported("bookpedia:1", "Dune (2a ed.)")],
      replace: false,
    });
    expect(twice.library.books).toHaveLength(sampleLibrary.books.length + 1);
    expect(twice.library.books.at(-1)?.title).toBe("Dune (2a ed.)");
    expect(twice.library.collections.filter((item) => item.name === "Libri")).toHaveLength(1);
    expect(twice.collectionId).toBe(importCollectionId("Libri"));
  });

  it("sostituendo, la biblioteca contiene solo i libri del file", () => {
    const next = libraryReducer(initialState(sampleLibrary), {
      type: "importBooks",
      collectionName: "Libri",
      books: [imported("bookpedia:1", "Dune")],
      replace: true,
    });
    expect(next.library.books.map((book) => book.id)).toEqual(["bookpedia:1"]);
    expect(
      next.library.collections.flatMap((item) => (item.kind === "regular" ? item.bookIds : [])),
    ).toEqual(["bookpedia:1"]);
  });
});

describe("nuove collezioni e libri aggiunti", () => {
  it("crea una collezione e ci mette il libro aggiunto", () => {
    const book = { ...sampleLibrary.books[0], id: "local:1", title: "Dune" };
    const state = run(
      { type: "createCollection", id: "collection:fantascienza", name: " Fantascienza ", select: true },
      { type: "addBook", book, collectionId: "collection:fantascienza" },
    );
    const created = state.library.collections.find((item) => item.id === "collection:fantascienza");
    expect(created).toMatchObject({ name: "Fantascienza", kind: "regular", bookIds: ["local:1"] });
    expect(state.collectionId).toBe("collection:fantascienza");
    expect(state.selectedBookId).toBe("local:1");
  });

  it("senza collezione il libro va solo nella Libreria", () => {
    const book = { ...sampleLibrary.books[0], id: "local:2" };
    const before = initialState(sampleLibrary).library.collections;
    expect(run({ type: "addBook", book }).library.collections).toEqual(before);
  });
});

describe("cartelle", () => {
  it("crea una cartella e una collezione al suo interno, aprendo la cartella", () => {
    const state = run(
      { type: "createCollection", id: "folder:generi", name: "Generi", kind: "folder" },
      { type: "toggleFolder", folderId: "folder:generi" },
      { type: "createCollection", id: "collection:gialli", name: "Gialli", parentId: "folder:generi" },
    );
    expect(state.library.collections.find((item) => item.id === "folder:generi")).toMatchObject({ kind: "folder", parentId: null });
    expect(state.library.collections.find((item) => item.id === "collection:gialli")).toMatchObject({
      kind: "regular",
      parentId: "folder:generi",
    });
    expect(state.collapsedFolders).not.toContain("folder:generi");
  });
});

describe("libri nelle collezioni", () => {
  const bookIdsOf = (state: ReturnType<typeof run>, id: string) => {
    const collection = state.library.collections.find((item) => item.id === id);
    return collection?.kind === "regular" ? collection.bookIds : [];
  };

  it("aggiunge un libro una volta sola e ignora gli id sconosciuti", () => {
    const state = run(
      { type: "addToCollection", bookIds: ["gattopardo", "gattopardo", "nessuno"], collectionId: "calvino" },
      { type: "addToCollection", bookIds: ["gattopardo"], collectionId: "calvino" },
    );
    expect(bookIdsOf(state, "calvino")).toEqual(["barone-rampante", "citta-invisibili", "gattopardo"]);
  });

  it("non tocca le collezioni che si calcolano da sole", () => {
    const before = initialState(sampleLibrary).library.collections;
    expect(run({ type: "addToCollection", bookIds: ["gattopardo"], collectionId: "top-rated" }).library.collections).toEqual(before);
  });

  it("toglie un libro dalla collezione, non dalla libreria", () => {
    const state = run({ type: "removeFromCollection", bookId: "barone-rampante", collectionId: "calvino" });
    expect(bookIdsOf(state, "calvino")).toEqual(["citta-invisibili"]);
    expect(state.library.books.some((book) => book.id === "barone-rampante")).toBe(true);
  });

  it("il lettore non può aggiungere né spostare", () => {
    const reader = reducerFor(false);
    const start = initialState(sampleLibrary);
    expect(reader(start, { type: "addToCollection", bookIds: ["gattopardo"], collectionId: "calvino" })).toBe(start);
    expect(reader(start, { type: "moveCollection", collectionId: "calvino", parentId: null, beforeId: null })).toBe(start);
  });
});

describe("spostare collezioni e cartelle", () => {
  const order = (state: ReturnType<typeof run>, parentId: string | null) =>
    state.library.collections.filter((item) => item.parentId === parentId).map((item) => item.id);

  it("porta una collezione fuori dalla cartella, in fondo", () => {
    const state = run({ type: "moveCollection", collectionId: "calvino", parentId: null, beforeId: null });
    expect(order(state, "authors")).toEqual([]);
    expect(order(state, null).at(-1)).toBe("calvino");
  });

  it("mette una collezione dentro una cartella, davanti a un'altra, e apre la cartella", () => {
    const state = run(
      { type: "toggleFolder", folderId: "authors" },
      { type: "moveCollection", collectionId: "import", parentId: "authors", beforeId: "calvino" },
    );
    expect(order(state, "authors")).toEqual(["import", "calvino"]);
    expect(state.collapsedFolders).not.toContain("authors");
  });

  it("riordina allo stesso livello", () => {
    const state = run({ type: "moveCollection", collectionId: "import", parentId: null, beforeId: "authors" });
    expect(order(state, null)).toEqual(["library", "loaned", "wishlist", "import", "authors", "top-rated"]);
  });

  it("annida una cartella in un'altra ma non dentro sé stessa o le sue figlie", () => {
    const state = run(
      { type: "createCollection", id: "generi", name: "Generi", kind: "folder" },
      { type: "createCollection", id: "gialli", name: "Gialli", kind: "folder", parentId: "generi" },
      { type: "moveCollection", collectionId: "authors", parentId: "generi", beforeId: null },
    );
    expect(order(state, "generi")).toEqual(["gialli", "authors"]);
    expect(libraryReducer(state, { type: "moveCollection", collectionId: "generi", parentId: "authors", beforeId: null })).toBe(state);
    expect(libraryReducer(state, { type: "moveCollection", collectionId: "generi", parentId: "generi", beforeId: null })).toBe(state);
  });

  it("le collezioni di sistema restano dove sono", () => {
    const start = initialState(sampleLibrary);
    expect(libraryReducer(start, { type: "moveCollection", collectionId: "library", parentId: "authors", beforeId: null })).toBe(start);
  });
});
