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
  /** Valori delle colonne personalizzate, per chiave della colonna. */
  readonly fields: Readonly<Record<string, string>>;
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

export const customColumnKinds = ["text", "number", "date"] as const;
export type CustomColumnKind = (typeof customColumnKinds)[number];

/**
 * Colonna creata dall'utente o arrivata da un import: vale per tutta la biblioteca.
 * `key` è il nome senza maiuscole né spazi ("Luogo di pubblicazione" → "luogodipubblicazione").
 */
export type CustomColumn = {
  readonly key: string;
  readonly label: string;
  readonly kind: CustomColumnKind;
  /** Campo del catalogo da cui vengono i valori (es. "translators"); null = valori liberi. */
  readonly catalogField: string | null;
  /** Per i valori liberi: la chiave in books.extra, come nel file importato (es. "placePublished"). */
  readonly extraKey: string | null;
};

export type Library = {
  readonly books: readonly Book[];
  readonly collections: readonly Collection[];
  readonly customColumns: readonly CustomColumn[];
};

// Tabella, griglia e galleria (carosello).
export const viewModes = ["list", "grid", "carousel"] as const;
export type ViewMode = (typeof viewModes)[number];

export const columnKeys = [
  "title",
  "subtitle",
  "authors",
  "publishedYear",
  "publisher",
  "genres",
  "series",
  "rating",
  "readStatus",
  "pages",
  "format",
  "language",
  "isbn13",
  "tags",
  "location",
  "summary",
  "notes",
  "addedAt",
] as const;
export type ColumnKey = (typeof columnKeys)[number];

/** Le colonne personalizzate hanno un id col prefisso, così non si confondono con quelle fisse. */
export type CustomColumnId = `field:${string}`;
export type ColumnId = ColumnKey | CustomColumnId;

/** Filtri della riga sotto le intestazioni della tabella: testo libero per colonna. */
export type ColumnFilters = Readonly<Partial<Record<ColumnId, string>>>;

export type SortKey = { readonly column: ColumnId; readonly direction: "asc" | "desc" };

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
