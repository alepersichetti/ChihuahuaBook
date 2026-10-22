import { describe, expect, it } from "vitest";
import type { Collection } from "./model";
import {
  booksInCollection,
  booksToAdd,
  canMoveInto,
  collectionsWithBook,
  isInside,
  stepPosition,
  folderPath,
  foldersWithPath,
  compareBooks,
  libraryBooks,
  loanState,
  matchesSearch,
  parseSearch,
  titleSortKey,
  toggleSort,
  visibleBooks,
} from "./query";
import { sampleLibrary } from "./sample-library";

const collection = (id: string): Collection => {
  const found = sampleLibrary.collections.find((item) => item.id === id);
  if (!found) throw new Error(`collezione ${id} mancante`);
  return found;
};

const titles = (books: readonly { title: string }[]) => books.map((book) => book.title);

describe("collezioni", () => {
  it("la Libreria esclude desideri e collezioni escluse", () => {
    const books = libraryBooks(sampleLibrary);
    expect(books).toHaveLength(8);
    expect(titles(books)).not.toContain("Il fu Mattia Pascal");
    expect(titles(books)).not.toContain("La Storia");
  });

  it("In prestito contiene solo i libri con un prestito aperto", () => {
    expect(titles(booksInCollection(sampleLibrary, collection("loaned"))).toSorted()).toEqual([
      "Il Gattopardo",
      "La coscienza di Zeno",
    ]);
  });

  it("una collezione smart applica le regole alla Libreria", () => {
    const books = booksInCollection(sampleLibrary, collection("top-rated"));
    expect(books).toHaveLength(7);
    expect(books.every((book) => (book.rating ?? 0) >= 4)).toBe(true);
  });

  it("una cartella mostra l'unione delle collezioni figlie", () => {
    expect(booksInCollection(sampleLibrary, collection("authors"))).toHaveLength(2);
  });
});

describe("ricerca", () => {
  it("divide i gruppi su 'or' e tiene le frasi tra virgolette", () => {
    expect(parseSearch('calvino "città invisibili" or eco')).toEqual([
      ["calvino", "citta invisibili"],
      ["eco"],
    ]);
  });

  it("ignora maiuscole e accenti", () => {
    const [book] = sampleLibrary.books.filter(matchesSearch("CITTA", "title"));
    expect(book?.title).toBe("Le città invisibili");
  });

  it("limita la ricerca al campo scelto", () => {
    expect(sampleLibrary.books.filter(matchesSearch("einaudi", "title"))).toHaveLength(0);
    expect(sampleLibrary.books.filter(matchesSearch("einaudi", "publisher")).length).toBeGreaterThan(0);
  });
});

describe("ordinamento", () => {
  it("ignora gli articoli iniziali del titolo", () => {
    expect(titleSortKey({ title: "Il Gattopardo", sortTitle: null })).toBe("gattopardo");
    expect(titleSortKey({ title: "L'amica geniale", sortTitle: null })).toBe("amica geniale");
  });

  it("ordina gli autori per cognome", () => {
    const books = libraryBooks(sampleLibrary).toSorted(
      compareBooks([{ column: "authors", direction: "asc" }]),
    );
    expect(books[0]?.authors[0]).toBe("Italo Calvino");
    expect(books.at(-1)?.authors[0]).toBe("Italo Svevo");
  });

  it("un secondo clic sulla stessa colonna inverte la direzione", () => {
    const once = toggleSort([], "title");
    expect(once).toEqual([{ column: "title", direction: "asc" }]);
    expect(toggleSort(once, "title")).toEqual([{ column: "title", direction: "desc" }]);
    expect(toggleSort(once, "rating")[0]).toEqual({ column: "rating", direction: "desc" });
  });

  it("i valori mancanti restano in fondo anche in ordine decrescente", () => {
    const books = sampleLibrary.books.toSorted(compareBooks([{ column: "rating", direction: "desc" }]));
    expect(books.at(-1)?.rating).toBeNull();
    expect(books[0]?.rating).toBe(5);
  });

  it("la pipeline applica collezione, ricerca, filtro e ordinamento", () => {
    const books = visibleBooks(sampleLibrary, collection("library"), {
      query: "",
      searchField: "all",
      valueFilter: { field: "authors", value: "Italo Calvino" },
      sort: [{ column: "publishedYear", direction: "desc" }],
    });
    expect(titles(books)).toEqual(["Le città invisibili", "Il barone rampante"]);
  });
});

describe("prestiti", () => {
  const loan = { borrower: "Marta", loanedOn: "2026-10-01", dueOn: "2026-10-28" };

  it("conta i giorni alla scadenza", () => {
    expect(loanState({ loan }, "2026-10-22")).toEqual({ kind: "due", borrower: "Marta", daysLeft: 6 });
  });

  it("segnala il ritardo", () => {
    expect(loanState({ loan }, "2026-10-31")).toEqual({ kind: "overdue", borrower: "Marta", daysLate: 3 });
  });

  it("senza data di oggi o scadenza il prestito è solo aperto", () => {
    expect(loanState({ loan }, null)).toEqual({ kind: "open", borrower: "Marta" });
    expect(loanState({ loan: null }, "2026-10-22")).toEqual({ kind: "none" });
  });
});

describe("folderPath", () => {
  const collections = [
    { id: "a", kind: "folder", name: "Autori", parentId: null },
    { id: "b", kind: "folder", name: "Italiani", parentId: "a" },
    { id: "c", kind: "regular", name: "Calvino", parentId: "b", bookIds: [], excluded: false },
  ] as const;

  it("restituisce il percorso delle cartelle", () => {
    expect(folderPath(collections, "b")).toEqual(["Autori", "Italiani"]);
    expect(folderPath(collections, null)).toEqual([]);
    expect(foldersWithPath(collections).map((folder) => folder.label)).toEqual(["Autori", "Autori / Italiani"]);
  });
});

describe("riorganizzare le collezioni", () => {
  const { collections } = sampleLibrary;

  it("riconosce cosa sta dentro una cartella", () => {
    expect(isInside(collections, "calvino", "authors")).toBe(true);
    expect(isInside(collections, "import", "authors")).toBe(false);
  });

  it("non sposta in una cartella che non esiste o dentro sé stessa", () => {
    expect(canMoveInto(collections, "calvino", null)).toBe(true);
    expect(canMoveInto(collections, "calvino", "import")).toBe(false);
    expect(canMoveInto(collections, "authors", "authors")).toBe(false);
    expect(canMoveInto(collections, "loaned", null)).toBe(false);
  });

  it("calcola lo spostamento di un posto tra le sorelle", () => {
    expect(stepPosition(collections, "top-rated", -1)).toEqual({ parentId: null, beforeId: "authors" });
    expect(stepPosition(collections, "top-rated", 1)).toEqual({ parentId: null, beforeId: null });
    expect(stepPosition(collections, "authors", -1)).toBeNull();
    expect(stepPosition(collections, "import", 1)).toBeNull();
  });

  it("propone i libri che la collezione non ha ancora", () => {
    const calvino = collection("calvino");
    expect(booksToAdd(sampleLibrary, calvino, "calvino").map((book) => book.id)).toEqual([]);
    expect(booksToAdd(sampleLibrary, calvino, "gattopardo").map((book) => book.id)).toEqual(["gattopardo"]);
    expect(booksToAdd(sampleLibrary, calvino, "  ")).toEqual([]);
  });

  it("elenca le collezioni che contengono un libro", () => {
    expect(collectionsWithBook(collections, "barone-rampante").map((item) => item.id)).toEqual(["calvino"]);
  });
});
