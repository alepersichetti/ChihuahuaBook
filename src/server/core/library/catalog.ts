import type { ResultAsync } from "neverthrow";
import type { AppError } from "../errors";

// La biblioteca intera per l'interfaccia, in forma leggera: tutto quello che serve
// per elenchi, ricerca e ordinamento, senza trama e note (decine di MB con un
// import vero). Il dettaglio completo di un libro si legge a parte, quando lo si apre.

export type CatalogBook = {
  readonly id: string;
  /** Programma d'origine e id che il libro aveva là (es. "bookpedia"), se importato. */
  readonly source: string | null;
  readonly source_id: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly authors: readonly string[];
  readonly publisher: string | null;
  readonly published_year: number | null;
  readonly isbn13: string | null;
  readonly pages: number | null;
  readonly format: string | null;
  readonly language: string | null;
  readonly genres: readonly string[];
  readonly series: string | null;
  readonly series_number: number | null;
  readonly cover_path: string | null;
  readonly cover_url: string | null;
  readonly read_status: "unread" | "reading" | "read" | "abandoned";
  readonly rating: number | null;
  readonly favorite: boolean;
  readonly tags: readonly string[];
  readonly location: string | null;
  /** Quando il libro è entrato in biblioteca nel programma d'origine (es. Bookpedia). */
  readonly date_added: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type CatalogCollection = {
  readonly id: string;
  readonly name: string;
  readonly position: number;
};

export type CatalogMembership = {
  readonly collection_id: string;
  readonly book_id: string;
};

export type CatalogLoan = {
  readonly book_id: string;
  readonly borrower: string;
  readonly loaned_on: string;
  readonly due_on: string | null;
};

export type Catalog = {
  readonly books: readonly CatalogBook[];
  readonly collections: readonly CatalogCollection[];
  readonly memberships: readonly CatalogMembership[];
  /** Solo i prestiti ancora aperti. */
  readonly loans: readonly CatalogLoan[];
};

/** Porta verso il catalogo condiviso; la RLS decide chi può leggerlo. */
export type CatalogStore = {
  readonly load: () => ResultAsync<Catalog, AppError>;
};
