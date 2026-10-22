"use client";

import { BookPlus, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n/i18n-context";
import { booksToAdd } from "../query";
import { Cover } from "./cover";
import { useLibrary } from "./library-context";

/** Pulsante che apre la ricerca: solo nelle collezioni normali e per chi può modificare. */
export function CollectionSearchButton({ className = "" }: { className?: string }) {
  const { state, collection, dispatch, canEdit } = useLibrary();
  const t = useT();
  if (!canEdit || collection?.kind !== "regular" || state.collectionSearchOpen) return null;
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "setCollectionSearchOpen", open: true })}
      className={`flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] font-medium ${className}`}
    >
      <BookPlus size={15} aria-hidden="true" />
      {t.collections.search.open}
    </button>
  );
}

// Cerca nella biblioteca i libri che la collezione non ha ancora e li aggiunge con un clic.
export function CollectionSearch({ className = "" }: { className?: string }) {
  const { state, collection, dispatch, canEdit } = useLibrary();
  const t = useT();
  const [query, setQuery] = useState("");
  if (!canEdit || collection?.kind !== "regular" || !state.collectionSearchOpen) return null;
  const results = booksToAdd(state.library, collection, query);
  const close = () => dispatch({ type: "setCollectionSearchOpen", open: false });
  const add = (bookId: string) => dispatch({ type: "addToCollection", bookIds: [bookId], collectionId: collection.id });
  return (
    <section
      aria-label={t.collections.search.label}
      className={`flex flex-col gap-2 rounded-xl border border-line bg-panel p-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 focus-within:border-accent">
          <Search size={15} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">{t.collections.search.label}</span>
          <input
            autoFocus
            type="search"
            value={query}
            placeholder={t.collections.search.placeholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                add(results[0].id);
              } else if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          aria-label={t.collections.search.close}
          title={t.collections.search.close}
          onClick={close}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-chip"
        >
          <X size={16} />
        </button>
      </div>
      {query.trim() !== "" && (
        <>
          <p role="status" className="px-1 text-xs text-muted">
            {results.length === 0 ? t.collections.search.noResults : t.collections.search.results(results.length)}
          </p>
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {results.map((book) => (
              <li key={book.id} className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-chip">
                <Cover book={book} size="xs" className="w-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{book.title}</span>
                  <span className="block truncate text-xs text-muted">{book.authors.join(", ")}</span>
                </span>
                <button
                  type="button"
                  aria-label={t.collections.search.addTitle(book.title)}
                  onClick={() => add(book.id)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 text-[13px] font-semibold text-accent-ink"
                >
                  <Plus size={14} aria-hidden="true" />
                  {t.collections.search.add}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
