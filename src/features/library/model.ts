// Modello di vista della libreria: dati già pronti per la UI, indipendenti da come il backend li salva.

export const readStatuses = ["unread", "reading", "read", "abandoned"] as const;
export type ReadStatus = (typeof readStatuses)[number];

export type Loan = {
  readonly borrower: string;
  readonly loanedOn: string; // ISO yyyy-mm-dd
  readonly dueOn: string | null;
};

export type Book = {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly sortTitle: string | null;
  readonly authors: readonly string[];
  readonly publisher: string | null;
  readonly publishedYear: number | null;
  readonly isbn13: string | null;
  readonly pages: number | null;
  readonly format: string | null;
  readonly language: string | null;
  readonly genres: readonly string[];
  readonly series: string | null;
  readonly seriesNumber: number | null;
  readonly summary: string | null;
  readonly notes: string | null;
  readonly tags: readonly string[];
  readonly location: string | null;
  readonly coverUrl: string | null;
  readonly readStatus: ReadStatus;
  readonly rating: number | null; // 0–5 a mezzi punti
  readonly favorite: boolean;
  readonly wishlist: boolean;
  readonly loan: Loan | null;
  readonly addedAt: string; // ISO
};

export type SmartField =
  | "author"
  | "genre"
  | "publisher"
  | "tag"
  | "rating"
  | "readStatus"
  | "publishedYear";

export type SmartCondition =
  | {
      readonly field: Exclude<SmartField, "rating" | "publishedYear">;
      readonly op: "is" | "contains";
      readonly value: string;
    }
  | {
      readonly field: "rating" | "publishedYear";
      readonly op: "gte" | "lte" | "is";
      readonly value: number;
    };

export type SmartRules = {
  readonly match: "all" | "any";
  readonly conditions: readonly SmartCondition[];
};

type CollectionBase = {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
};

// Le collezioni speciali esistono una volta sola; le altre le crea l'utente.
export type Collection =
  | (CollectionBase & { readonly kind: "library" | "loaned" | "wishlist" })
  | (CollectionBase & {
      readonly kind: "regular";
      readonly bookIds: readonly string[];
      readonly excluded: boolean; // fuori dalla Libreria, es. un import da rivedere
    })
  | (CollectionBase & { readonly kind: "smart"; readonly rules: SmartRules })
  | (CollectionBase & { readonly kind: "folder" });

export type CollectionKind = Collection["kind"];

export type Library = {
  readonly books: readonly Book[];
  readonly collections: readonly Collection[];
};

// Tabella, griglia, galleria (carosello) e scaffale (carosello con la scheda sotto).
export const viewModes = ["list", "grid", "carousel", "shelf"] as const;
export type ViewMode = (typeof viewModes)[number];

export const columnKeys = [
  "title",
  "authors",
  "publishedYear",
  "publisher",
  "genres",
  "series",
  "rating",
  "readStatus",
  "pages",
  "location",
  "addedAt",
] as const;
export type ColumnKey = (typeof columnKeys)[number];

export type SortKey = { readonly column: ColumnKey; readonly direction: "asc" | "desc" };

export const searchFields = ["all", "title", "authors", "publisher", "genres", "tags", "isbn13"] as const;
export type SearchField = (typeof searchFields)[number];

// Filtro nato dal clic su un valore nel pannello dettagli (es. un autore).
export type ValueFilter = {
  readonly field: "authors" | "genres" | "publisher" | "series" | "tags" | "publishedYear" | "readStatus";
  readonly value: string;
};

// Disposizione della finestra: A classica (predefinita), B galleria, C scaffale scuro.
// La palette cambia solo i colori (e il carattere dei titoli), con qualsiasi vista.
export const palettes = ["light", "warm", "dark"] as const;
export type Palette = (typeof palettes)[number];
