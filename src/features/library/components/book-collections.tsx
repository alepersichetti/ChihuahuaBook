"use client";

import { BookCopy, Check, Plus, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "../../i18n/i18n-context";
import type { Book } from "../model";
import { collectionsWithBook, folderPath, normalize } from "../query";
import { useLibrary } from "./library-context";
import { NewCollectionInput, newCollectionId } from "./new-collection-input";

// Elenco con caselle: spuntare aggiunge il libro alla collezione, togliere la spunta lo toglie.
function CollectionPicker({ book, onClose }: { book: Book; onClose: () => void }) {
  const { state, dispatch } = useLibrary();
  const t = useT();
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const { collections } = state.library;
  const options = collections
    .filter((collection) => collection.kind === "regular")
    .map((collection) => ({
      collection,
      path: [...folderPath(collections, collection.parentId), collection.name].join(" / "),
      checked: collection.bookIds.includes(book.id),
    }))
    .filter((option) => normalize(option.path).includes(normalize(filter)))
    .sort((a, b) => a.path.localeCompare(b.path));
  const regular = collections.some((collection) => collection.kind === "regular");
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-2 shadow-lg"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {regular && (
        <label className="flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-bg px-2 focus-within:border-accent">
          <Search size={14} className="text-muted" aria-hidden="true" />
          <span className="sr-only">{t.collections.ofBook.filter}</span>
          <input
            autoFocus
            value={filter}
            placeholder={t.collections.ofBook.filter}
            onChange={(event) => setFilter(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      )}
      <ul className="flex max-h-56 flex-col overflow-y-auto text-[13px]">
        {options.map(({ collection, path, checked }) => (
          <li key={collection.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-chip">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  dispatch(
                    checked
                      ? { type: "removeFromCollection", bookId: book.id, collectionId: collection.id }
                      : { type: "addToCollection", bookIds: [book.id], collectionId: collection.id },
                  )
                }
                className="accent-(--accent)"
              />
              <span className="truncate">{path}</span>
            </label>
          </li>
        ))}
        {options.length === 0 && (
          <li className="px-2 py-1.5 text-muted">{regular ? t.collections.ofBook.noMatches : t.collections.ofBook.noneYet}</li>
        )}
      </ul>
      <div className="border-t border-line pt-1.5">
        {creating ? (
          <NewCollectionInput
            onCancel={() => setCreating(false)}
            onCreate={(collection) => {
              const id = newCollectionId();
              dispatch({ type: "createCollection", id, ...collection });
              dispatch({ type: "addToCollection", bookIds: [book.id], collectionId: id });
              setCreating(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-accent hover:bg-chip"
          >
            <Plus size={14} aria-hidden="true" />
            {t.collections.new}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent text-[13px] font-semibold text-accent-ink"
      >
        <Check size={14} aria-hidden="true" />
        {t.common.done}
      </button>
    </div>
  );
}

/** Le collezioni del libro nella scheda: si aprono con un clic e, per chi modifica, si cambiano. */
export function BookCollections({ book }: { book: Book }) {
  const { state, dispatch, canEdit } = useLibrary();
  const t = useT();
  const [picking, setPicking] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const inside = collectionsWithBook(state.library.collections, book.id);
  if (!canEdit && inside.length === 0) return null;
  const close = () => {
    setPicking(false);
    // Il pulsante torna dopo la chiusura: il fuoco ci va al fotogramma successivo.
    requestAnimationFrame(() => toggle.current?.focus());
  };
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{t.collections.ofBook.title}</h3>
      {inside.length === 0 ? (
        <p className="text-[13px] text-muted">{t.collections.ofBook.none}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {inside.map((collection) => (
            <li key={collection.id} className="flex items-center rounded-full bg-chip text-xs font-medium">
              <button
                type="button"
                title={t.collections.ofBook.open(collection.name)}
                onClick={() => dispatch({ type: "selectCollection", collectionId: collection.id })}
                className={`flex items-center gap-1.5 py-1 pl-2.5 ${canEdit ? "pr-1" : "pr-2.5"}`}
              >
                <BookCopy size={12} className="text-tone-collection" aria-hidden="true" />
                {collection.name}
              </button>
              {canEdit && (
                <button
                  type="button"
                  aria-label={t.collections.ofBook.remove(collection.name)}
                  title={t.collections.ofBook.remove(collection.name)}
                  onClick={() => dispatch({ type: "removeFromCollection", bookId: book.id, collectionId: collection.id })}
                  className="mr-1 rounded-full p-0.5 text-muted hover:bg-line hover:text-ink"
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit &&
        (picking ? (
          <CollectionPicker book={book} onClose={close} />
        ) : (
          <button
            ref={toggle}
            type="button"
            aria-expanded={picking}
            onClick={() => setPicking(true)}
            className="flex h-8 items-center gap-1.5 self-start rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] font-medium"
          >
            <Plus size={14} aria-hidden="true" />
            {t.collections.ofBook.add}
          </button>
        ))}
    </section>
  );
}
