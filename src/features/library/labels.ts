import type { ColumnKey, Layout, ReadStatus, SearchField, ValueFilter } from "./model";

export const readStatusLabel: Record<ReadStatus, string> = {
  unread: "Da leggere",
  reading: "In lettura",
  read: "Letto",
  abandoned: "Abbandonato",
};

export const columnLabel: Record<ColumnKey, string> = {
  title: "Titolo",
  authors: "Autore",
  publishedYear: "Anno",
  publisher: "Editore",
  genres: "Genere",
  series: "Serie",
  rating: "Voto",
  readStatus: "Lettura",
  pages: "Pagine",
  location: "Posizione",
  addedAt: "Aggiunto",
};

export const searchFieldLabel: Record<SearchField, string> = {
  all: "Tutti i campi",
  title: "Titolo",
  authors: "Autore",
  publisher: "Editore",
  genres: "Genere",
  tags: "Tag",
  isbn13: "ISBN",
};

export const valueFilterLabel: Record<ValueFilter["field"], string> = {
  authors: "Autore",
  genres: "Genere",
  publisher: "Editore",
  series: "Serie",
  tags: "Tag",
  publishedYear: "Anno",
  readStatus: "Lettura",
};

export const layoutLabel: Record<Layout, string> = {
  classic: "Classica",
  gallery: "Galleria",
  warm: "Calda",
  shelf: "Scaffale",
};

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;
