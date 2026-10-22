"use client";

import { BookCopy, Plus, X } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useT } from "../../i18n/i18n-context";
import type { Book, Collection } from "../model";
import { collectionsWithBook, folderPath, normalize } from "../query";
import { useLibrary } from "./library-context";
import { newCollectionId } from "./new-collection-input";

const pathOf = (collections: readonly Collection[], collection: Collection) =>
  [...folderPath(collections, collection.parentId), collection.name].join(" / ");

type Option =
  | { readonly kind: "existing"; readonly collection: Collection; readonly path: string }
  | { readonly kind: "create"; readonly name: string };

function Tag({ collection, path, onRemove }: { collection: Collection; path: string; onRemove?: () => void }) {
  const { dispatch } = useLibrary();
  const t = useT();
  return (
    <li className="flex items-center rounded-full bg-chip text-xs font-medium">
      <button
        type="button"
        title={t.collections.ofBook.open(path)}
        onClick={() => dispatch({ type: "selectCollection", collectionId: collection.id })}
        className={`flex items-center gap-1.5 py-1 pl-2.5 ${onRemove ? "pr-1" : "pr-2.5"}`}
      >
        <BookCopy size={12} className="text-tone-collection" aria-hidden="true" />
        {collection.name}
      </button>
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t.collections.ofBook.remove(collection.name)}
          title={t.collections.ofBook.remove(collection.name)}
          onClick={onRemove}
          className="mr-1 rounded-full p-0.5 text-muted hover:bg-line hover:text-ink"
        >
          <X size={12} />
        </button>
      )}
    </li>
  );
}

/**
 * Le collezioni del libro come tag: ogni tag è una collezione. Scrivendo compaiono i suggerimenti;
 * Invio aggiunge, Backspace a campo vuoto toglie l'ultimo tag, e un nome nuovo crea la collezione.
 */
export function BookCollections({ book }: { book: Book }) {
  const { state, dispatch, canEdit } = useLibrary();
  const t = useT();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { collections } = state.library;
  const inside = collectionsWithBook(collections, book.id);
  if (!canEdit && inside.length === 0) return null;

  const wanted = normalize(text);
  const existing: readonly Option[] = collections
    .filter((collection) => collection.kind === "regular" && !collection.bookIds.includes(book.id))
    .map((collection) => ({ kind: "existing" as const, collection, path: pathOf(collections, collection) }))
    .filter((option) => normalize(option.path).includes(wanted))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 8);
  const exact = collections.some((collection) => collection.kind === "regular" && normalize(collection.name) === wanted);
  const options: readonly Option[] =
    wanted !== "" && !exact ? [...existing, { kind: "create", name: text.trim() }] : existing;
  const current = Math.min(active, Math.max(0, options.length - 1));

  const add = (collectionId: string) => dispatch({ type: "addToCollection", bookIds: [book.id], collectionId });
  const remove = (collectionId: string) =>
    dispatch({ type: "removeFromCollection", bookId: book.id, collectionId });
  const choose = (option: Option) => {
    if (option.kind === "existing") add(option.collection.id);
    else {
      const id = newCollectionId();
      dispatch({ type: "createCollection", id, name: option.name });
      add(id);
    }
    setText("");
    setActive(0);
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step !== 0 && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((current + step + options.length) % options.length);
    } else if (event.key === "Enter" && open && options[current]) {
      event.preventDefault();
      choose(options[current]);
    } else if (event.key === "Backspace" && text === "" && inside.length > 0) {
      remove(inside[inside.length - 1].id);
    } else if (event.key === "Escape" && (open || text !== "")) {
      // Esc chiude i suggerimenti, non la scheda.
      event.stopPropagation();
      setOpen(false);
      setText("");
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{t.collections.ofBook.title}</h3>
      {!canEdit ? (
        <ul className="flex flex-wrap gap-1.5">
          {inside.map((collection) => (
            <Tag key={collection.id} collection={collection} path={pathOf(collections, collection)} />
          ))}
        </ul>
      ) : (
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
          }}
        >
          <div
            onClick={() => input.current?.focus()}
            className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1.5 focus-within:border-accent"
          >
            <ul className="contents">
              {inside.map((collection) => (
                <Tag
                  key={collection.id}
                  collection={collection}
                  path={pathOf(collections, collection)}
                  onRemove={() => remove(collection.id)}
                />
              ))}
            </ul>
            <input
              ref={input}
              role="combobox"
              aria-label={t.collections.ofBook.placeholder}
              aria-expanded={open && options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && options[current] ? `${listId}-${current}` : undefined}
              value={text}
              placeholder={inside.length === 0 ? t.collections.ofBook.placeholder : ""}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setText(event.target.value);
                setActive(0);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              className="h-6 min-w-24 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
          {open && (
            <ul
              id={listId}
              role="listbox"
              aria-label={t.collections.ofBook.suggestions}
              className="absolute inset-x-0 top-full z-30 mt-1 flex max-h-60 flex-col overflow-y-auto rounded-lg border border-line bg-surface p-1 text-[13px] shadow-lg"
            >
              {options.map((option, index) => (
                <li
                  key={option.kind === "existing" ? option.collection.id : "create"}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === current}
                  // mousedown, non click: così il campo non perde il fuoco e la lista resta aperta.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${index === current ? "bg-chip" : ""}`}
                >
                  {option.kind === "existing" ? (
                    <>
                      <BookCopy size={14} className="shrink-0 text-tone-collection" aria-hidden="true" />
                      <span className="truncate">{option.path}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} className="shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate text-accent">{t.collections.ofBook.create(option.name)}</span>
                    </>
                  )}
                </li>
              ))}
              {options.length === 0 && <li className="px-2 py-1.5 text-muted">{t.collections.ofBook.noMatches}</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
