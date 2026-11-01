import type { Catalog, CatalogBook } from "@/server/core/library/catalog";
import { localBookId } from "../import/to-library";
import type { Book, Collection, Library, Loan } from "./model";

// Dal catalogo del database al modello della UI: funzioni pure, nessun accesso alla rete.

/** Le collezioni di sistema esistono sempre, anche con il database vuoto. */
export const systemCollections: readonly Collection[] = [
  { id: "library", kind: "library", name: "Libreria", parentId: null },
  { id: "loaned", kind: "loaned", name: "In prestito", parentId: null },
  { id: "wishlist", kind: "wishlist", name: "Lista desideri", parentId: null },
];

/** La copertina caricata passa dal server, che controlla il ruolo; `v` la rinnova quando cambia. */
export const coverUrlOf = (row: Pick<CatalogBook, "id" | "cover_path" | "cover_url" | "updated_at">) =>
  row.cover_path
    ? `/api/books/${encodeURIComponent(row.id)}/cover?v=${encodeURIComponent(row.updated_at)}`
    : row.cover_url;

const addedAtOf = (row: CatalogBook) => {
  const original = row.date_added ? new Date(row.date_added) : null;
  return original && !Number.isNaN(original.getTime()) ? original.toISOString() : row.created_at;
};

export const bookFromCatalog = (row: CatalogBook, loan: Loan | null): Book => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  sortTitle: null,
  authors: row.authors,
  publisher: row.publisher,
  publishedYear: row.published_year,
  isbn13: row.isbn13,
  pages: row.pages,
  format: row.format,
  language: row.language,
  genres: row.genres,
  series: row.series,
  seriesNumber: row.series_number === null ? null : Number(row.series_number),
  summary: null,
  notes: null,
  tags: row.tags,
  location: row.location,
  coverUrl: coverUrlOf(row),
  readStatus: row.read_status,
  rating: row.rating,
  favorite: row.favorite,
  wishlist: false,
  loan,
  addedAt: addedAtOf(row),
  detailsPending: true,
  ...(row.source === "bookpedia" && row.source_id ? { importKey: localBookId(row.source_id) } : {}),
});

export const libraryFromCatalog = (catalog: Catalog): Library => {
  const loans = new Map(
    catalog.loans.map((loan) => [loan.book_id, { borrower: loan.borrower, loanedOn: loan.loaned_on, dueOn: loan.due_on }]),
  );
  const members = Map.groupBy(catalog.memberships, (membership) => membership.collection_id);
  return {
    books: catalog.books.map((row) => bookFromCatalog(row, loans.get(row.id) ?? null)),
    collections: [
      ...systemCollections,
      ...catalog.collections.map(
        (collection): Collection => ({
          id: collection.id,
          kind: "regular",
          name: collection.name,
          parentId: null,
          bookIds: (members.get(collection.id) ?? []).map((membership) => membership.book_id),
          excluded: false,
        }),
      ),
    ],
  };
};

/** Trama e note arrivate dal server: il libro torna completo. */
export const withDetails = (book: Book, details: { readonly summary: string | null; readonly notes: string | null }): Book => ({
  ...book,
  summary: details.summary,
  notes: details.notes,
  detailsPending: false,
});
