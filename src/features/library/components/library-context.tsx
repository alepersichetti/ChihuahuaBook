"use client";

import { createContext, use, useMemo, useReducer, useSyncExternalStore, type ReactNode } from "react";
import type { Library } from "../model";
import { booksInCollection, visibleBooks } from "../query";
import {
  currentCollection,
  currentColumns,
  currentSort,
  currentView,
  initialState,
  libraryReducer,
  selectedBook,
  type LibraryAction,
  type LibraryState,
} from "../state";

const todayIso = () => new Date().toISOString().slice(0, 10);
const noSubscription = () => () => {};

// La data di oggi esiste solo nel browser: sul server i prestiti restano "aperti".
const useToday = () => useSyncExternalStore(noSubscription, todayIso, () => null);

const useLibraryValue = (library: Library) => {
  const [state, dispatch] = useReducer(libraryReducer, library, initialState);
  const today = useToday();
  const derived = useMemo(() => {
    const collection = currentCollection(state) ?? state.library.collections[0];
    const sort = currentSort(state);
    const books = collection
      ? visibleBooks(state.library, collection, {
          query: state.query,
          searchField: state.searchField,
          valueFilter: state.valueFilter,
          sort,
        })
      : [];
    const counts = Object.fromEntries(
      state.library.collections.map((item) => [item.id, booksInCollection(state.library, item).length]),
    );
    return {
      collection,
      books,
      counts,
      sort,
      view: currentView(state),
      columns: currentColumns(state),
      selected: selectedBook(state),
    };
  }, [state]);
  return { state, dispatch, today, ...derived };
};

type LibraryContextValue = ReturnType<typeof useLibraryValue>;

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ library, children }: { library: Library; children: ReactNode }) {
  return <LibraryContext value={useLibraryValue(library)}>{children}</LibraryContext>;
}

export const useLibrary = () => {
  const value = use(LibraryContext);
  if (!value) throw new Error("useLibrary va usato dentro LibraryProvider");
  return value;
};

export type { LibraryAction, LibraryState };
