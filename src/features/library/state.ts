import type {
  Book,
  Collection,
  ColumnKey,
  Library,
  Loan,
  ReadStatus,
  SearchField,
  SortKey,
  ValueFilter,
  ViewMode,
} from "./model";
import { canMoveInto, toggleSort } from "./query";

export type LibraryState = {
  readonly library: Library;
  readonly collectionId: string;
  readonly selectedBookId: string | null;
  // Come Bookpedia, ogni collezione ricorda vista, colonne e ordinamento.
  readonly viewByCollection: Readonly<Record<string, ViewMode>>;
  readonly columnsByCollection: Readonly<Record<string, readonly ColumnKey[]>>;
  readonly sortByCollection: Readonly<Record<string, readonly SortKey[]>>;
  readonly lastView: ViewMode;
  readonly query: string;
  readonly searchField: SearchField;
  readonly valueFilter: ValueFilter | null;
  readonly detailsOpen: boolean;
  readonly sidebarOpen: boolean;
  readonly coverSize: number;
  readonly collapsedFolders: readonly string[];
  // Su telefono si vede una schermata alla volta.
  readonly mobileScreen: "list" | "book" | "collections";
  readonly importOpen: boolean;
  readonly addOpen: boolean;
  // Ricerca dentro una collezione per aggiungerci libri.
  readonly collectionSearchOpen: boolean;
};

export type LibraryAction =
  | { readonly type: "selectCollection"; readonly collectionId: string }
  | { readonly type: "selectBook"; readonly bookId: string | null }
  | { readonly type: "setView"; readonly view: ViewMode }
  | { readonly type: "toggleColumn"; readonly column: ColumnKey }
  | { readonly type: "sortBy"; readonly column: ColumnKey }
  | { readonly type: "setQuery"; readonly query: string }
  | { readonly type: "setSearchField"; readonly field: SearchField }
  | { readonly type: "setValueFilter"; readonly filter: ValueFilter | null }
  | { readonly type: "toggleDetails" }
  | { readonly type: "setSidebarOpen"; readonly open: boolean }
  | { readonly type: "setCoverSize"; readonly size: number }
  | { readonly type: "toggleFolder"; readonly folderId: string }
  | { readonly type: "setRating"; readonly bookId: string; readonly rating: number | null }
  | { readonly type: "setReadStatus"; readonly bookId: string; readonly status: ReadStatus }
  | { readonly type: "toggleFavorite"; readonly bookId: string }
  | { readonly type: "lend"; readonly bookId: string; readonly loan: Loan }
  | { readonly type: "returnBook"; readonly bookId: string }
  | { readonly type: "setMobileScreen"; readonly screen: LibraryState["mobileScreen"] }
  | { readonly type: "openBook"; readonly bookId: string }
  | { readonly type: "setImportOpen"; readonly open: boolean }
  | {
      readonly type: "importBooks";
      readonly books: readonly Book[];
      readonly collectionName: string;
      /** La biblioteca diventa uguale al file: i libri che non ci sono spariscono. */
      readonly replace: boolean;
    }
  | { readonly type: "setAddOpen"; readonly open: boolean }
  | { readonly type: "addBook"; readonly book: Book; readonly collectionId?: string | null }
  | {
      readonly type: "createCollection";
      readonly id: string;
      readonly name: string;
      readonly kind?: "regular" | "folder";
      readonly parentId?: string | null;
      readonly select?: boolean;
    }
  | { readonly type: "addToCollection"; readonly bookIds: readonly string[]; readonly collectionId: string }
  | { readonly type: "removeFromCollection"; readonly bookId: string; readonly collectionId: string }
  | {
      readonly type: "moveCollection";
      readonly collectionId: string;
      /** La cartella di arrivo; null = fuori dalle cartelle. */
      readonly parentId: string | null;
      /** La collezione davanti a cui si mette; null = in fondo alla cartella. */
      readonly beforeId: string | null;
    }
  | { readonly type: "setCollectionSearchOpen"; readonly open: boolean };

export const defaultColumns: readonly ColumnKey[] = [
  "title",
  "authors",
  "publishedYear",
  "genres",
  "rating",
];

export const defaultSort: readonly SortKey[] = [{ column: "title", direction: "asc" }];


export const coverSizes = { min: 96, max: 220, initial: 136 } as const;

export const initialState = (library: Library): LibraryState => ({
  library,
  collectionId: library.collections.find((collection) => collection.kind === "library")?.id ?? "",
  selectedBookId: null,
  viewByCollection: {},
  columnsByCollection: {},
  sortByCollection: {},
  lastView: "list",
  query: "",
  searchField: "all",
  valueFilter: null,
  detailsOpen: true,
  sidebarOpen: false,
  coverSize: coverSizes.initial,
  collapsedFolders: [],
  mobileScreen: "list",
  importOpen: false,
  addOpen: false,
  collectionSearchOpen: false,
});

// Selettori -------------------------------------------------------------------

export const currentCollection = (state: LibraryState): Collection | undefined =>
  state.library.collections.find((collection) => collection.id === state.collectionId);

export const currentView = (state: LibraryState) =>
  state.viewByCollection[state.collectionId] ?? state.lastView;

export const currentColumns = (state: LibraryState) =>
  state.columnsByCollection[state.collectionId] ?? defaultColumns;

export const currentSort = (state: LibraryState) =>
  state.sortByCollection[state.collectionId] ?? defaultSort;

export const selectedBook = (state: LibraryState) =>
  state.library.books.find((book) => book.id === state.selectedBookId) ?? null;

// Reducer ---------------------------------------------------------------------

const updateBook = (state: LibraryState, bookId: string, update: (book: Book) => Book) => ({
  ...state,
  library: {
    ...state.library,
    books: state.library.books.map((book) => (book.id === bookId ? update(book) : book)),
  },
});

// Ogni import finisce anche in una collezione col nome del file, come in Bookpedia.
export const importCollectionId = (name: string) => `import:${name.trim().toLowerCase()}`;

const addImported = (state: LibraryState, books: readonly Book[], name: string, replace: boolean): LibraryState => {
  const ids = new Set(books.map((book) => book.id));
  const kept = replace ? [] : state.library.books.filter((book) => !ids.has(book.id));
  const present = new Set([...kept, ...books].map((book) => book.id));
  const id = importCollectionId(name);
  const collection: Collection = {
    id,
    name,
    parentId: null,
    kind: "regular",
    bookIds: books.map((book) => book.id),
    excluded: false,
  };
  return {
    ...state,
    library: {
      // Reimportare sostituisce i libri con lo stesso id invece di duplicarli.
      books: [...kept, ...books],
      collections: [
        ...state.library.collections
          .filter((item) => item.id !== id)
          // Le collezioni restano, ma senza i libri eliminati dalla sostituzione.
          .map((item) =>
            item.kind === "regular" ? { ...item, bookIds: item.bookIds.filter((bookId) => present.has(bookId)) } : item,
          ),
        collection,
      ],
    },
    collectionId: id,
    selectedBookId: null,
    valueFilter: null,
  };
};

const withCollections = (state: LibraryState, update: (collections: readonly Collection[]) => readonly Collection[]) => ({
  ...state,
  library: { ...state.library, collections: update(state.library.collections) },
});

// Solo le collezioni normali hanno un elenco di libri: le altre si calcolano da sole.
const editBookIds = (
  collections: readonly Collection[],
  collectionId: string,
  update: (bookIds: readonly string[]) => readonly string[],
) =>
  collections.map((item) => (item.kind === "regular" && item.id === collectionId ? { ...item, bookIds: update(item.bookIds) } : item));

const moveCollection = (
  collections: readonly Collection[],
  id: string,
  parentId: string | null,
  beforeId: string | null,
): readonly Collection[] => {
  const item = collections.find((collection) => collection.id === id);
  if (!item || beforeId === id || !canMoveInto(collections, id, parentId)) return collections;
  const rest = collections.filter((collection) => collection.id !== id);
  const before = rest.findIndex((collection) => collection.id === beforeId && collection.parentId === parentId);
  // Senza un punto preciso va in fondo alla cartella, dopo l'ultima sorella.
  const last = rest.findLastIndex((collection) => collection.parentId === parentId);
  const index = before >= 0 ? before : last >= 0 ? last + 1 : rest.length;
  return [...rest.slice(0, index), { ...item, parentId }, ...rest.slice(index)];
};

const toggleIn = <T,>(values: readonly T[], value: T) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export const libraryReducer = (state: LibraryState, action: LibraryAction): LibraryState => {
  switch (action.type) {
    case "selectCollection":
      return {
        ...state,
        collectionId: action.collectionId,
        lastView: currentView(state),
        valueFilter: null,
        sidebarOpen: false,
        mobileScreen: "list",
        collectionSearchOpen: false,
      };
    case "selectBook":
      return { ...state, selectedBookId: action.bookId };
    case "setView":
      return {
        ...state,
        lastView: action.view,
        viewByCollection: { ...state.viewByCollection, [state.collectionId]: action.view },
      };
    case "toggleColumn": {
      const columns = toggleIn(currentColumns(state), action.column);
      // Il titolo resta sempre: senza non si capisce quale libro sia.
      return columns.includes("title")
        ? { ...state, columnsByCollection: { ...state.columnsByCollection, [state.collectionId]: columns } }
        : state;
    }
    case "sortBy":
      return {
        ...state,
        sortByCollection: {
          ...state.sortByCollection,
          [state.collectionId]: toggleSort(currentSort(state), action.column),
        },
      };
    case "setQuery":
      return { ...state, query: action.query };
    case "setSearchField":
      return { ...state, searchField: action.field };
    case "setValueFilter":
      return { ...state, valueFilter: action.filter };
    case "toggleDetails":
      return { ...state, detailsOpen: !state.detailsOpen };
    case "setSidebarOpen":
      return { ...state, sidebarOpen: action.open };
    case "setCoverSize":
      return {
        ...state,
        coverSize: Math.min(coverSizes.max, Math.max(coverSizes.min, action.size)),
      };
    case "toggleFolder":
      return { ...state, collapsedFolders: toggleIn(state.collapsedFolders, action.folderId) };
    case "setRating":
      return updateBook(state, action.bookId, (book) => ({ ...book, rating: action.rating }));
    case "setReadStatus":
      return updateBook(state, action.bookId, (book) => ({ ...book, readStatus: action.status }));
    case "toggleFavorite":
      return updateBook(state, action.bookId, (book) => ({ ...book, favorite: !book.favorite }));
    case "lend":
      return updateBook(state, action.bookId, (book) => ({ ...book, loan: action.loan }));
    case "returnBook":
      return updateBook(state, action.bookId, (book) => ({ ...book, loan: null }));
    case "setMobileScreen":
      return { ...state, mobileScreen: action.screen };
    case "openBook":
      return { ...state, selectedBookId: action.bookId, mobileScreen: "book" };
    case "setImportOpen":
      return { ...state, importOpen: action.open };
    case "importBooks":
      return addImported(state, action.books, action.collectionName, action.replace);
    case "setAddOpen":
      return { ...state, addOpen: action.open };
    case "addBook":
      return {
        ...state,
        library: {
          books: [...state.library.books.filter((book) => book.id !== action.book.id), action.book],
          collections: state.library.collections.map((item) =>
            item.kind === "regular" && item.id === action.collectionId && !item.bookIds.includes(action.book.id)
              ? { ...item, bookIds: [...item.bookIds, action.book.id] }
              : item,
          ),
        },
        selectedBookId: action.book.id,
      };
    case "createCollection": {
      const base = { id: action.id, name: action.name.trim(), parentId: action.parentId ?? null };
      const collection: Collection =
        action.kind === "folder" ? { ...base, kind: "folder" } : { ...base, kind: "regular", bookIds: [], excluded: false };
      return {
        ...state,
        library: { ...state.library, collections: [...state.library.collections, collection] },
        // La cartella che la contiene si apre, così la nuova voce si vede.
        collapsedFolders: state.collapsedFolders.filter((id) => id !== action.parentId),
        ...(action.select ? { collectionId: action.id, selectedBookId: null, valueFilter: null } : {}),
      };
    }
    case "addToCollection": {
      const known = new Set(state.library.books.map((book) => book.id));
      return withCollections(state, (collections) =>
        editBookIds(collections, action.collectionId, (bookIds) => [
          ...bookIds,
          ...[...new Set(action.bookIds)].filter((id) => known.has(id) && !bookIds.includes(id)),
        ]),
      );
    }
    case "removeFromCollection":
      return withCollections(state, (collections) =>
        editBookIds(collections, action.collectionId, (bookIds) => bookIds.filter((id) => id !== action.bookId)),
      );
    case "moveCollection": {
      const collections = moveCollection(state.library.collections, action.collectionId, action.parentId, action.beforeId);
      // La cartella di arrivo si apre, così si vede dove è finita.
      return collections === state.library.collections
        ? state
        : {
            ...state,
            library: { ...state.library, collections },
            collapsedFolders: state.collapsedFolders.filter((id) => id !== action.parentId),
          };
    }
    case "setCollectionSearchOpen":
      return { ...state, collectionSearchOpen: action.open };
  }
};

// Azioni che cambiano i dati del catalogo: al lettore non arrivano mai.
export const editingActions: ReadonlySet<LibraryAction["type"]> = new Set([
  "setRating",
  "setReadStatus",
  "toggleFavorite",
  "lend",
  "returnBook",
  "setImportOpen",
  "importBooks",
  "setAddOpen",
  "addBook",
  "createCollection",
  "addToCollection",
  "removeFromCollection",
  "moveCollection",
  "setCollectionSearchOpen",
]);

/** Il reducer giusto per chi usa l'app: in sola lettura ignora le modifiche. */
export const reducerFor = (canEdit: boolean) =>
  canEdit
    ? libraryReducer
    : (state: LibraryState, action: LibraryAction): LibraryState =>
        editingActions.has(action.type) ? state : libraryReducer(state, action);
