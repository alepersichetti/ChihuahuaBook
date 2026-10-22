import type {
  Book,
  Collection,
  ColumnKey,
  Layout,
  Library,
  Loan,
  ReadStatus,
  SearchField,
  SortKey,
  ValueFilter,
  ViewMode,
} from "./model";
import { toggleSort } from "./query";

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
  readonly layout: Layout;
  // Su telefono si vede una schermata alla volta.
  readonly mobileScreen: "list" | "book" | "collections";
  readonly importOpen: boolean;
  readonly addOpen: boolean;
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
  | { readonly type: "setLayout"; readonly layout: Layout }
  | { readonly type: "setMobileScreen"; readonly screen: LibraryState["mobileScreen"] }
  | { readonly type: "openBook"; readonly bookId: string }
  | { readonly type: "setImportOpen"; readonly open: boolean }
  | { readonly type: "importBooks"; readonly books: readonly Book[]; readonly collectionName: string }
  | { readonly type: "setAddOpen"; readonly open: boolean }
  | { readonly type: "addBook"; readonly book: Book };

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
  layout: "classic",
  mobileScreen: "list",
  importOpen: false,
  addOpen: false,
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

const addImported = (state: LibraryState, books: readonly Book[], name: string): LibraryState => {
  const ids = new Set(books.map((book) => book.id));
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
      books: [...state.library.books.filter((book) => !ids.has(book.id)), ...books],
      collections: [...state.library.collections.filter((item) => item.id !== id), collection],
    },
    collectionId: id,
    selectedBookId: null,
    valueFilter: null,
  };
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
    // Il layout cambia solo la disposizione: la vista (lista, griglia, carosello) resta quella scelta.
    case "setLayout":
      return { ...state, layout: action.layout };
    case "setMobileScreen":
      return { ...state, mobileScreen: action.screen };
    case "openBook":
      return { ...state, selectedBookId: action.bookId, mobileScreen: "book" };
    case "setImportOpen":
      return { ...state, importOpen: action.open };
    case "importBooks":
      return addImported(state, action.books, action.collectionName);
    case "setAddOpen":
      return { ...state, addOpen: action.open };
    case "addBook":
      return {
        ...state,
        library: {
          ...state.library,
          books: [...state.library.books.filter((book) => book.id !== action.book.id), action.book],
        },
        selectedBookId: action.book.id,
      };
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
]);

/** Il reducer giusto per chi usa l'app: in sola lettura ignora le modifiche. */
export const reducerFor = (canEdit: boolean) =>
  canEdit
    ? libraryReducer
    : (state: LibraryState, action: LibraryAction): LibraryState =>
        editingActions.has(action.type) ? state : libraryReducer(state, action);
