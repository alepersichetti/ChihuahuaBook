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
  matchesColumnFilters,
  matchesSearch,
  parseNumberFilter,
  parseSearch,
  titleSortKey,
  toggleSort,
  visibleBooks,
  filterBooks,
  normalize,
  sortedBooks,
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

describe("filtri per colonna", () => {
  const books = sampleLibrary.books;
  const columns = ["title", "authors", "publishedYear", "rating", "readStatus"] as const;

  it("legge numeri, confronti e intervalli", () => {
    expect(parseNumberFilter("1990")).toEqual({ op: "eq", value: 1990 });
    expect(parseNumberFilter(">= 1990")).toEqual({ op: "gte", value: 1990 });
    expect(parseNumberFilter("<300")).toEqual({ op: "lt", value: 300 });
    expect(parseNumberFilter("1990-1980")).toEqual({ op: "between", from: 1980, to: 1990 });
    expect(parseNumberFilter("anni 80")).toBeNull();
  });

  it("combina i filtri di più colonne, senza accenti né maiuscole", () => {
    const found = books.filter(matchesColumnFilters({ authors: "CALVINO", title: "citta" }, columns));
    expect(titles(found)).toEqual(["Le città invisibili"]);
  });

  it("filtra anno, voto e stato di lettura", () => {
    const filter = matchesColumnFilters({ publishedYear: "1950-1960", rating: "4" }, columns);
    expect(titles(books.filter(filter)).toSorted()).toEqual(["Il Gattopardo", "Il barone rampante"]);
    expect(titles(books.filter(matchesColumnFilters({ readStatus: "reading" }, columns)))).toContain("L'amica geniale");
    expect(books.filter(matchesColumnFilters({ rating: "none" }, columns)).every((book) => book.rating === null)).toBe(true);
  });

  it("ignora i filtri delle colonne nascoste", () => {
    expect(books.filter(matchesColumnFilters({ publisher: "nessuno" }, columns))).toHaveLength(books.length);
  });

  it("entra nella pipeline della vista", () => {
    const found = visibleBooks(sampleLibrary, collection("library"), {
      query: "",
      searchField: "all",
      valueFilter: null,
      sort: [{ column: "title", direction: "asc" }],
      columnFilters: { filters: { authors: "svevo" }, columns },
    });
    expect(titles(found)).toEqual(["La coscienza di Zeno"]);
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

describe("prestazioni della ricerca", () => {
  const library = collection("library");
  const sort = [{ column: "authors", direction: "asc" }] as const;

  it("ordinare una volta e poi filtrare dà lo stesso risultato della pipeline completa", () => {
    const options = { query: "calvino or pirandello", searchField: "all", valueFilter: null } as const;
    const sorted = sortedBooks(sampleLibrary, library, sort);
    expect(filterBooks(sorted, options)).toEqual(visibleBooks(sampleLibrary, library, { ...options, sort }));
  });

  it("normalize toglie accenti e maiuscole, anche nel testo lungo", () => {
    expect(normalize("  Perché CITTÀ  ")).toBe("perche citta");
    expect(normalize("Tolstòj Lev Nikolaević")).toBe("tolstoj lev nikolaevic");
    expect(normalize("Plain ASCII")).toBe("plain ascii");
  });

  it("un libro modificato è un oggetto nuovo: la ricerca vede il testo nuovo", () => {
    const [book] = sampleLibrary.books;
    expect(matchesSearch("zibaldone", "title")(book)).toBe(false);
    expect(matchesSearch("zibaldone", "title")({ ...book, title: "Zibaldone" })).toBe(true);
  });
});

describe("colonne personalizzate", () => {
  const books = libraryBooks(sampleLibrary).map((book, index) => ({
    ...book,
    // Valori di prova: un numero per metà dei libri, un luogo per tutti, una data per uno.
    fields: {
      ...(index % 2 === 0 ? { copie: String(index + 1) } : {}),
      luogo: index < 3 ? "Italia" : "Francia",
      ...(index === 0 ? { acquisto: "2024-03-12" } : {}),
    },
  }));
  const columns = ["title", "field:copie", "field:luogo", "field:acquisto"] as const;

  it("cerca come testo e accetta >, < e intervalli sui numeri", () => {
    expect(books.filter(matchesColumnFilters({ "field:luogo": "ital" }, columns))).toHaveLength(3);
    const many = books.filter(matchesColumnFilters({ "field:copie": ">4" }, columns));
    expect(many.map((book) => book.fields.copie)).toEqual(["5", "7"]);
    expect(books.filter(matchesColumnFilters({ "field:copie": "1-3" }, columns))).toHaveLength(2);
  });

  it("le date si cercano anche come gg/mm/aaaa", () => {
    expect(books.filter(matchesColumnFilters({ "field:acquisto": "12/03/2024" }, columns))).toHaveLength(1);
    expect(books.filter(matchesColumnFilters({ "field:acquisto": "2024-03" }, columns))).toHaveLength(1);
  });

  it("ordina i numeri come numeri e mette in fondo i valori mancanti", () => {
    const sorted = books.toSorted(compareBooks([{ column: "field:copie", direction: "desc" }]));
    expect(sorted.map((book) => book.fields.copie ?? null)).toEqual(["7", "5", "3", "1", null, null, null, null]);
  });

  it("al primo clic ordina in ordine crescente", () => {
    expect(toggleSort([], "field:luogo")).toEqual([{ column: "field:luogo", direction: "asc" }]);
  });
});
