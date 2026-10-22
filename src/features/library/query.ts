import type {
  Book,
  Collection,
  ColumnKey,
  Library,
  SearchField,
  SmartCondition,
  SmartRules,
  SortKey,
  ValueFilter,
} from "./model";

// Testo -----------------------------------------------------------------------

export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const leadingArticle = /^(il|lo|la|i|gli|le|un|uno|una|the|an?)\s+|^(l|un|dell|nell)['’]\s*/i;

// Chiave di ordinamento del titolo: ignora gli articoli iniziali, come l'opzione di Bookpedia.
export const titleSortKey = (book: Pick<Book, "title" | "sortTitle">) =>
  normalize(book.sortTitle ?? book.title.replace(leadingArticle, ""));

// "Italo Calvino" → "calvino italo": ordina per cognome.
export const surnameKey = (name: string) => {
  const parts = normalize(name).split(/\s+/);
  return [...parts.slice(-1), ...parts.slice(0, -1)].join(" ");
};

// Collezioni ------------------------------------------------------------------

const excludedBookIds = (collections: readonly Collection[]) =>
  new Set(
    collections.flatMap((collection) =>
      collection.kind === "regular" && collection.excluded ? collection.bookIds : [],
    ),
  );

// La Libreria: tutto tranne i desideri e i libri presenti solo in collezioni escluse.
export const libraryBooks = ({ books, collections }: Library) => {
  const excluded = excludedBookIds(collections);
  return books.filter((book) => !book.wishlist && !excluded.has(book.id));
};

const conditionMatches = (book: Book, condition: SmartCondition) => {
  switch (condition.field) {
    case "rating":
    case "publishedYear": {
      const actual = book[condition.field];
      if (actual === null) return false;
      return condition.op === "gte"
        ? actual >= condition.value
        : condition.op === "lte"
          ? actual <= condition.value
          : actual === condition.value;
    }
    default: {
      const values = valuesOf(book, condition.field).map(normalize);
      const wanted = normalize(condition.value);
      return condition.op === "is"
        ? values.includes(wanted)
        : values.some((value) => value.includes(wanted));
    }
  }
};

const valuesOf = (book: Book, field: "author" | "genre" | "publisher" | "tag" | "readStatus") => {
  switch (field) {
    case "author":
      return book.authors;
    case "genre":
      return book.genres;
    case "tag":
      return book.tags;
    case "publisher":
      return book.publisher ? [book.publisher] : [];
    case "readStatus":
      return [book.readStatus];
  }
};

export const matchesRules = (rules: SmartRules) => (book: Book) =>
  rules.conditions.length === 0
    ? true
    : rules.match === "all"
      ? rules.conditions.every((condition) => conditionMatches(book, condition))
      : rules.conditions.some((condition) => conditionMatches(book, condition));

export const childrenOf = (collections: readonly Collection[], parentId: string | null) =>
  collections.filter((collection) => collection.parentId === parentId);

export const booksInCollection = (library: Library, collection: Collection): readonly Book[] => {
  switch (collection.kind) {
    case "library":
      return libraryBooks(library);
    case "loaned":
      return library.books.filter((book) => book.loan !== null);
    case "wishlist":
      return library.books.filter((book) => book.wishlist);
    case "regular": {
      const ids = new Set(collection.bookIds);
      return library.books.filter((book) => ids.has(book.id));
    }
    case "smart":
      return libraryBooks(library).filter(matchesRules(collection.rules));
    case "folder": {
      // Una cartella mostra l'unione delle collezioni che contiene.
      const ids = new Set(
        childrenOf(library.collections, collection.id)
          .flatMap((child) => booksInCollection(library, child))
          .map((book) => book.id),
      );
      return library.books.filter((book) => ids.has(book.id));
    }
  }
};

// Ricerca ---------------------------------------------------------------------

// Sintassi di Bookpedia: termini in AND, "or" tra gruppi, virgolette per la frase esatta.
export const parseSearch = (query: string): readonly (readonly string[])[] =>
  query
    .split(/\s+or\s+/i)
    .map((group) =>
      [...group.matchAll(/"([^"]+)"|(\S+)/g)]
        .map((match) => normalize(match[1] ?? match[2]))
        .filter((term) => term !== ""),
    )
    .filter((group) => group.length > 0);

const searchableText = (book: Book, field: SearchField) => {
  switch (field) {
    case "title":
      return [book.title, book.subtitle ?? ""];
    case "authors":
      return book.authors;
    case "publisher":
      return [book.publisher ?? ""];
    case "genres":
      return book.genres;
    case "tags":
      return book.tags;
    case "isbn13":
      return [book.isbn13 ?? ""];
    case "all":
      return [
        book.title,
        book.subtitle ?? "",
        ...book.authors,
        book.publisher ?? "",
        ...book.genres,
        ...book.tags,
        book.series ?? "",
        book.isbn13 ?? "",
        book.summary ?? "",
        book.notes ?? "",
        book.location ?? "",
        book.loan?.borrower ?? "",
      ];
  }
};

export const matchesSearch = (query: string, field: SearchField) => {
  const groups = parseSearch(query);
  return (book: Book) => {
    if (groups.length === 0) return true;
    const text = normalize(searchableText(book, field).join(" \u0000 "));
    return groups.some((terms) => terms.every((term) => text.includes(term)));
  };
};

export const valueFilterOf = (book: Book, field: ValueFilter["field"]): readonly string[] => {
  switch (field) {
    case "authors":
    case "genres":
    case "tags":
      return book[field];
    case "publisher":
    case "series":
      return book[field] ? [book[field]] : [];
    case "publishedYear":
      return book.publishedYear === null ? [] : [String(book.publishedYear)];
    case "readStatus":
      return [book.readStatus];
  }
};

export const matchesValueFilter = (filter: ValueFilter | null) => (book: Book) =>
  filter === null || valueFilterOf(book, filter.field).includes(filter.value);

// Ordinamento -----------------------------------------------------------------

type Comparable = string | number | null;

const sortValue = (book: Book, column: ColumnKey): Comparable => {
  switch (column) {
    case "title":
      return titleSortKey(book);
    case "authors":
      return book.authors[0] ? surnameKey(book.authors[0]) : null;
    case "genres":
      return book.genres[0] ? normalize(book.genres[0]) : null;
    case "publisher":
    case "series":
    case "location":
      return book[column] ? normalize(book[column]) : null;
    case "readStatus":
      return ["reading", "unread", "read", "abandoned"].indexOf(book.readStatus);
    case "addedAt":
      return book.addedAt;
    case "publishedYear":
    case "pages":
    case "rating":
      return book[column];
  }
};

// I valori mancanti finiscono sempre in fondo, in qualunque direzione.
const compareValues = (a: Comparable, b: Comparable) =>
  a === b
    ? 0
    : a === null
      ? 1
      : b === null
        ? -1
        : typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), "it");

const compareByKey = (a: Book, b: Book, { column, direction }: SortKey) => {
  const left = sortValue(a, column);
  const right = sortValue(b, column);
  const result = compareValues(left, right);
  return left === null || right === null || direction === "asc" ? result : -result;
};

// Fino a sei criteri in cascata; a parità decide il titolo.
export const compareBooks = (keys: readonly SortKey[]) => (a: Book, b: Book) =>
  [
    ...keys.map((key) => compareByKey(a, b, key)),
    compareValues(titleSortKey(a), titleSortKey(b)),
  ].find((result) => result !== 0) ?? 0;

export const maxSortKeys = 6;

// Clic su un'intestazione: diventa il criterio principale; un secondo clic inverte la direzione.
export const toggleSort = (keys: readonly SortKey[], column: ColumnKey): readonly SortKey[] => {
  const [first] = keys;
  if (first?.column === column) {
    return [{ column, direction: first.direction === "asc" ? "desc" : "asc" }, ...keys.slice(1)];
  }
  const defaultDirection: SortKey["direction"] =
    column === "rating" || column === "addedAt" ? "desc" : "asc";
  return [
    { column, direction: defaultDirection },
    ...keys.filter((key) => key.column !== column),
  ].slice(0, maxSortKeys);
};

// Pipeline completa per la vista centrale.
export const visibleBooks = (
  library: Library,
  collection: Collection,
  options: {
    readonly query: string;
    readonly searchField: SearchField;
    readonly valueFilter: ValueFilter | null;
    readonly sort: readonly SortKey[];
  },
) =>
  booksInCollection(library, collection)
    .filter(matchesSearch(options.query, options.searchField))
    .filter(matchesValueFilter(options.valueFilter))
    .toSorted(compareBooks(options.sort));

// Prestiti --------------------------------------------------------------------

const dayMs = 86_400_000;

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / dayMs);

export type LoanState =
  | { readonly kind: "none" }
  | { readonly kind: "open"; readonly borrower: string }
  | { readonly kind: "due"; readonly borrower: string; readonly daysLeft: number }
  | { readonly kind: "overdue"; readonly borrower: string; readonly daysLate: number };

export const loanState = (book: Pick<Book, "loan">, today: string | null): LoanState => {
  const { loan } = book;
  if (loan === null) return { kind: "none" };
  if (loan.dueOn === null || today === null) return { kind: "open", borrower: loan.borrower };
  const daysLeft = daysBetween(today, loan.dueOn);
  return daysLeft < 0
    ? { kind: "overdue", borrower: loan.borrower, daysLate: -daysLeft }
    : { kind: "due", borrower: loan.borrower, daysLeft };
};

export const addDays = (isoDate: string, days: number) =>
  new Date(Date.parse(isoDate) + days * dayMs).toISOString().slice(0, 10);
