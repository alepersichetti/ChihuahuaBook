// Statistiche della biblioteca: funzioni pure sui libri, la UI le mostra e basta.

import type { Book, Library, ReadStatus } from "./model";
import { readStatuses } from "./model";
import { libraryBooks, loanState } from "./query";

export type Tally = { readonly value: string; readonly count: number };

export type ActiveLoan = {
  readonly book: Book;
  readonly borrower: string;
  readonly loanedOn: string;
  readonly dueOn: string | null;
  /** Giorni di ritardo; 0 se non è in ritardo o non ha scadenza. */
  readonly daysLate: number;
};

export type LibraryStats = {
  readonly total: number;
  readonly authors: number;
  readonly pages: number;
  readonly withPages: number;
  readonly rated: number;
  readonly averageRating: number | null;
  readonly favorites: number;
  readonly wishlist: number;
  readonly readStatus: readonly { readonly status: ReadStatus; readonly count: number }[];
  readonly topAuthors: readonly Tally[];
  readonly topGenres: readonly Tally[];
  readonly topPublishers: readonly Tally[];
  readonly languages: readonly Tally[];
  readonly formats: readonly Tally[];
  readonly decades: readonly { readonly decade: number; readonly count: number }[];
  readonly addedByYear: readonly { readonly year: number; readonly count: number }[];
  readonly ratings: readonly { readonly stars: number; readonly count: number }[];
  readonly loans: readonly ActiveLoan[];
  readonly overdue: number;
  readonly topBorrowers: readonly Tally[];
};

const clean = (value: string | null) => value?.trim() || null;

/** Conta i valori (già ripuliti), dal più frequente; a parità, in ordine alfabetico. */
export const tally = (values: readonly string[], limit = Number.POSITIVE_INFINITY): readonly Tally[] =>
  [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>())]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);

// Un libro con due autori conta per entrambi, ma un autore ripetuto nello stesso libro conta una volta.
const perBook = (books: readonly Book[], pick: (book: Book) => readonly (string | null)[]) =>
  books.flatMap((book) => [...new Set(pick(book).map(clean).filter((value) => value !== null))]);

/**
 * Righe contigue da `from` a `to` (comprese), con zero dove non c'è nulla: i buchi si vedono.
 * Un anno sbagliato (es. 1 invece di 2001) allungherebbe l'elenco a dismisura: oltre `maxRows`
 * restano solo le righe con qualche libro.
 */
const contiguous = (counts: ReadonlyMap<number, number>, step: number, maxRows = 40) => {
  const keys = [...counts.keys()].sort((a, b) => a - b);
  if (keys.length === 0) return [];
  const from = keys[0];
  const to = keys[keys.length - 1];
  if ((to - from) / step + 1 > maxRows) return keys.map((key) => ({ key, count: counts.get(key) ?? 0 }));
  return Array.from({ length: (to - from) / step + 1 }, (_, index) => from + index * step).map((key) => ({
    key,
    count: counts.get(key) ?? 0,
  }));
};

const countBy = (keys: readonly number[]) =>
  keys.reduce((counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1), new Map<number, number>());

export const decadeOf = (year: number) => Math.floor(year / 10) * 10;

const yearOf = (iso: string) => {
  const year = Number(iso.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
};

const activeLoans = (books: readonly Book[], today: string | null): readonly ActiveLoan[] =>
  books
    .flatMap((book) => {
      if (!book.loan) return [];
      const state = loanState(book, today);
      return [{ book, ...book.loan, daysLate: state.kind === "overdue" ? state.daysLate : 0 }];
    })
    // Prima i ritardi (il più grave in cima), poi le scadenze più vicine, poi i prestiti senza scadenza.
    .sort(
      (a, b) =>
        b.daysLate - a.daysLate ||
        (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") ||
        a.loanedOn.localeCompare(b.loanedOn),
    );

/** Statistiche della Libreria (senza lista desideri e collezioni escluse), come la vede la barra laterale. */
export const libraryStats = (library: Library, today: string | null, top = 10): LibraryStats => {
  const books = libraryBooks(library);
  const withPages = books.filter((book) => book.pages !== null && book.pages > 0);
  const rated = books.filter((book) => book.rating !== null && book.rating > 0);
  const years = books.flatMap((book) => (book.publishedYear !== null && book.publishedYear > 0 ? [book.publishedYear] : []));
  const loans = activeLoans(books, today);
  return {
    total: books.length,
    authors: new Set(perBook(books, (book) => book.authors)).size,
    pages: withPages.reduce((sum, book) => sum + (book.pages ?? 0), 0),
    withPages: withPages.length,
    rated: rated.length,
    averageRating: rated.length === 0 ? null : rated.reduce((sum, book) => sum + (book.rating ?? 0), 0) / rated.length,
    favorites: books.filter((book) => book.favorite).length,
    wishlist: library.books.filter((book) => book.wishlist).length,
    readStatus: readStatuses.map((status) => ({
      status,
      count: books.filter((book) => book.readStatus === status).length,
    })),
    topAuthors: tally(perBook(books, (book) => book.authors), top),
    topGenres: tally(perBook(books, (book) => book.genres), top),
    topPublishers: tally(perBook(books, (book) => [book.publisher]), top),
    languages: tally(perBook(books, (book) => [book.language]), top),
    formats: tally(perBook(books, (book) => [book.format]), top),
    decades: contiguous(countBy(years.map(decadeOf)), 10).map(({ key, count }) => ({ decade: key, count })),
    addedByYear: contiguous(countBy(books.flatMap((book) => yearOf(book.addedAt) ?? [])), 1).map(({ key, count }) => ({
      year: key,
      count,
    })),
    // Da 1 a 5 stelle: i mezzi punti vanno con la stella intera sotto (3,5 → 3).
    ratings: [1, 2, 3, 4, 5].map((stars) => ({
      stars,
      count: rated.filter((book) => Math.max(1, Math.floor(book.rating ?? 0)) === stars).length,
    })),
    loans,
    overdue: loans.filter((loan) => loan.daysLate > 0).length,
    topBorrowers: tally(loans.map((loan) => loan.borrower.trim()).filter(Boolean), 5),
  };
};

/** Percentuale intera, senza dividere per zero. */
export const percent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100));
