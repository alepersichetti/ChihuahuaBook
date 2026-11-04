import { describe, expect, it } from "vitest";
import type { Book, Library } from "./model";
import { sampleLibrary } from "./sample-library";
import { decadeOf, libraryStats, percent, tally } from "./stats";

const base = sampleLibrary.books[0];
const book = (id: string, patch: Partial<Book>): Book => ({
  ...base,
  id,
  authors: [],
  genres: [],
  publisher: null,
  language: null,
  format: null,
  pages: null,
  rating: null,
  favorite: false,
  wishlist: false,
  loan: null,
  readStatus: "unread",
  publishedYear: null,
  addedAt: "2024-03-01T10:00:00Z",
  ...patch,
});

const libraryOf = (books: readonly Book[], collections: Library["collections"] = sampleLibrary.collections): Library => ({
  books,
  collections,
  customColumns: [],
});

describe("tally", () => {
  it("conta i valori dal più frequente, a parità in ordine alfabetico, e taglia al limite", () => {
    expect(tally(["b", "a", "b", "c", "a", "b"], 2)).toEqual([
      { value: "b", count: 3 },
      { value: "a", count: 2 },
    ]);
  });
});

describe("libraryStats", () => {
  const books = [
    book("1", { authors: ["Italo Calvino"], genres: ["Romanzo"], pages: 200, rating: 4, readStatus: "read", publishedYear: 1957, favorite: true }),
    book("2", { authors: ["Italo Calvino", "Italo Calvino "], genres: ["Romanzo", "Fiabe"], pages: 100, rating: 3.5, publishedYear: 1979 }),
    book("3", { authors: ["Umberto Eco"], publisher: " Bompiani ", rating: 0, readStatus: "reading", publishedYear: 1980, addedAt: "2026-01-02T00:00:00Z" }),
    book("4", { authors: ["Desiderato"], wishlist: true, pages: 999 }),
  ];
  const stats = libraryStats(libraryOf(books), "2026-11-01");

  it("conta solo la Libreria: i desideri restano a parte", () => {
    expect(stats.total).toBe(3);
    expect(stats.wishlist).toBe(1);
    expect(stats.authors).toBe(2);
    expect(stats.pages).toBe(300);
    expect(stats.withPages).toBe(2);
    expect(stats.favorites).toBe(1);
  });

  it("un autore ripetuto nello stesso libro conta una volta, gli spazi non contano", () => {
    expect(stats.topAuthors).toEqual([
      { value: "Italo Calvino", count: 2 },
      { value: "Umberto Eco", count: 1 },
    ]);
    expect(stats.topPublishers).toEqual([{ value: "Bompiani", count: 1 }]);
    expect(stats.topGenres[0]).toEqual({ value: "Romanzo", count: 2 });
  });

  it("il voto medio ignora i libri senza voto (0 compreso), i mezzi punti vanno sotto", () => {
    expect(stats.rated).toBe(2);
    expect(stats.averageRating).toBe(3.75);
    expect(stats.ratings.find((row) => row.stars === 3)?.count).toBe(1);
    expect(stats.ratings.find((row) => row.stars === 4)?.count).toBe(1);
  });

  it("ogni stato di lettura ha la sua riga, anche a zero", () => {
    expect(stats.readStatus).toEqual([
      { status: "unread", count: 1 },
      { status: "reading", count: 1 },
      { status: "read", count: 1 },
      { status: "abandoned", count: 0 },
    ]);
  });

  it("decenni e anni di aggiunta sono contigui, con gli zeri nei buchi", () => {
    expect(stats.decades).toEqual([
      { decade: 1950, count: 1 },
      { decade: 1960, count: 0 },
      { decade: 1970, count: 1 },
      { decade: 1980, count: 1 },
    ]);
    expect(stats.addedByYear).toEqual([
      { year: 2024, count: 2 },
      { year: 2025, count: 0 },
      { year: 2026, count: 1 },
    ]);
  });

  it("un anno sbagliato non allunga l'elenco dei decenni all'infinito", () => {
    const odd = libraryStats(libraryOf([book("a", { publishedYear: 2 }), book("b", { publishedYear: 2001 })]), null);
    expect(odd.decades).toEqual([
      { decade: 0, count: 1 },
      { decade: 2000, count: 1 },
    ]);
  });

  it("prestiti: prima i ritardi, poi le scadenze più vicine, poi quelli senza scadenza", () => {
    const loans = libraryStats(
      libraryOf([
        book("open", { loan: { borrower: "Anna", loanedOn: "2026-01-01", dueOn: null } }),
        book("soon", { loan: { borrower: "Bruno", loanedOn: "2026-10-01", dueOn: "2026-11-10" } }),
        book("late", { loan: { borrower: "Anna", loanedOn: "2026-09-01", dueOn: "2026-10-20" } }),
      ]),
      "2026-11-01",
    );
    expect(loans.loans.map((loan) => [loan.book.id, loan.daysLate])).toEqual([
      ["late", 12],
      ["soon", 0],
      ["open", 0],
    ]);
    expect(loans.overdue).toBe(1);
    expect(loans.topBorrowers[0]).toEqual({ value: "Anna", count: 2 });
  });

  it("con la biblioteca vuota non divide per zero", () => {
    const empty = libraryStats(libraryOf([]), null);
    expect(empty.total).toBe(0);
    expect(empty.averageRating).toBeNull();
    expect(empty.decades).toEqual([]);
    expect(percent(0, 0)).toBe(0);
  });

  it("i decenni arrotondano per difetto", () => {
    expect(decadeOf(1989)).toBe(1980);
    expect(decadeOf(2000)).toBe(2000);
  });
});
