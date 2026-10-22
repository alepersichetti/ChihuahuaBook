import type { PediaBook } from "@/server/core/books/pedia";
import type { Book } from "../library/model";

/** Id locale stabile: reimportare lo stesso libro sostituisce quello già in vista. */
export const localBookId = (sourceId: string) => `bookpedia:${sourceId}`;

// Bookpedia ricorda quando il libro è entrato in libreria: meglio della data dell'import.
const addedOn = (extra: PediaBook["extra"], fallback: string) => {
  const value = extra.dateAdded;
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
};

/** Libro importato nel modello di vista, per mostrarlo subito nella libreria. */
export const toLibraryBook = (
  { sourceId, book, extra }: PediaBook,
  coverUrl: string | null,
  addedAt: string,
): Book => ({
  id: localBookId(sourceId),
  title: book.title,
  subtitle: book.subtitle ?? null,
  sortTitle: null,
  authors: book.authors,
  publisher: book.publisher ?? null,
  publishedYear: book.published_year ?? null,
  isbn13: book.isbn13 ?? null,
  pages: book.pages ?? null,
  format: book.format ?? null,
  language: book.language ?? null,
  genres: book.genres,
  series: book.series ?? null,
  seriesNumber: book.series_number ?? null,
  summary: book.summary ?? null,
  notes: book.notes ?? null,
  tags: book.tags,
  location: book.location ?? null,
  coverUrl,
  readStatus: book.read_status,
  rating: book.rating ?? null,
  favorite: book.favorite,
  wishlist: false,
  loan: null,
  addedAt: addedOn(extra, addedAt),
});
