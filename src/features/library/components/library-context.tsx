"use client";

import { createContext, use, useDeferredValue, useEffect, useMemo, useReducer, useSyncExternalStore, type ReactNode } from "react";
import { can, type SignedInViewer } from "@/features/auth/viewer";
import { useSettings } from "../../settings/settings-context";
import type { Library } from "../model";
import { booksInCollection, filterBooks, searchText, sortedBooks } from "../query";
import type { Book, SearchField } from "../model";
import {
  currentCollection,
  currentColumns,
  currentSort,
  currentView,
  initialState,
  reducerFor,
  selectedBook,
  type LibraryAction,
  type LibraryState,
} from "../state";

const todayIso = () => new Date().toISOString().slice(0, 10);
const noSubscription = () => () => {};

// La data di oggi esiste solo nel browser: sul server i prestiti restano "aperti".
const useToday = () => useSyncExternalStore(noSubscription, todayIso, () => null);

// Il primo tasto costerebbe la normalizzazione di tutto il testo (note e riassunti
// compresi): la si fa prima, a pezzi, quando il browser non ha altro da fare.
const useWarmSearchIndex = (books: readonly Book[], field: SearchField) => {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run: IdleRequestCallback) => window.setTimeout(() => run({ didTimeout: false, timeRemaining: () => 8 }), 50));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    let next = 0;
    let handle = 0;
    const work = (deadline: IdleDeadline) => {
      while (next < books.length && deadline.timeRemaining() > 1) {
        searchText(books[next], field);
        next += 1;
      }
      if (next < books.length) handle = idle(work);
    };
    handle = idle(work);
    return () => cancel(handle);
  }, [books, field]);
};

const useLibraryValue = (library: Library, viewer: SignedInViewer) => {
  const canEdit = can(viewer.role, "edit");
  const isAdmin = can(viewer.role, "administer");
  const [state, dispatch] = useReducer(reducerFor(canEdit), library, initialState);
  const today = useToday();
  const { preferences } = useSettings();

  // La dimensione delle copertine è una preferenza: le impostazioni la decidono, la libreria la segue.
  useEffect(() => {
    dispatch({ type: "setCoverSize", size: preferences.coverSize });
  }, [preferences.coverSize]);
  // La ricerca e i filtri arrivano differiti: il campo risponde subito a ogni tasto,
  // l'elenco si aggiorna appena il browser è libero, e un tasto nuovo interrompe il calcolo vecchio.
  const deferred = useDeferredValue(state);
  const shown = deferred.library;
  const shownCollection = currentCollection(deferred) ?? shown.collections[0];
  const sort = currentSort(deferred);
  // Ordinare non dipende dalla ricerca: si rifà solo se cambiano libri, collezione o criteri.
  const sorted = useMemo(
    () => (shownCollection ? sortedBooks(shown, shownCollection, sort) : []),
    [shown, shownCollection, sort],
  );
  const books = useMemo(
    () =>
      filterBooks(sorted, {
        query: deferred.query,
        searchField: deferred.searchField,
        valueFilter: deferred.valueFilter,
      }),
    [sorted, deferred.query, deferred.searchField, deferred.valueFilter],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        state.library.collections.map((item) => [item.id, booksInCollection(state.library, item).length]),
      ),
    [state.library],
  );
  useWarmSearchIndex(state.library.books, state.searchField);
  const derived = {
    collection: currentCollection(state) ?? state.library.collections[0],
    books,
    counts,
    sort: currentSort(state),
    view: currentView(state),
    columns: currentColumns(state),
    selected: selectedBook(state),
  };
  return { state, dispatch, today, viewer, canEdit, isAdmin, ...derived };
};

type LibraryContextValue = ReturnType<typeof useLibraryValue>;

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({
  library,
  viewer,
  children,
}: {
  library: Library;
  viewer: SignedInViewer;
  children: ReactNode;
}) {
  return <LibraryContext value={useLibraryValue(library, viewer)}>{children}</LibraryContext>;
}

export const useLibrary = () => {
  const value = use(LibraryContext);
  if (!value) throw new Error("useLibrary va usato dentro LibraryProvider");
  return value;
};

export type { LibraryAction, LibraryState };
