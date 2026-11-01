"use client";

import { ArrowDown, ArrowUp, BookMarked, ChevronLeft, ChevronRight, Columns3, FilterX, HandHelping } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Messages } from "../../i18n/messages";
import { useI18n, useT } from "../../i18n/i18n-context";
import { columnKeys, readStatuses, type Book, type ColumnKey } from "../model";
import { hasColumnFilters, loanState, unratedFilter } from "../query";
import { Cover } from "./cover";
import { CollectionSearchButton } from "./collection-search";
import { draggableBook } from "./drag";
import { useLibrary } from "./library-context";
import { useFinePointer, useWide } from "./media";
import { Rating } from "./rating";
import { useTouchDragSource } from "./touch-drag";

// Un libro si trascina su una collezione: col mouse in modo nativo, col dito tenendolo premuto.
// Sull'iPad in verticale le collezioni sono chiuse in un riquadro: si apre da solo.
const useBookDrag = () => {
  const { canEdit, dispatch } = useLibrary();
  const fine = useFinePointer();
  const wide = useWide();
  const touch = useTouchDragSource();
  const showCollections = () => {
    if (!wide) dispatch({ type: "setSidebarOpen", open: true });
  };
  return (book: Book) =>
    canEdit
      ? { ...(fine ? draggableBook(book.id) : {}), ...touch({ kind: "book", id: book.id, label: book.title }, showCollections) }
      : {};
};

// Selezione con le frecce, come nella lista di Bookpedia.
const useArrowSelection = () => {
  const { books, selected, dispatch } = useLibrary();
  return (event: KeyboardEvent, keys: { previous: string; next: string }) => {
    const step = event.key === keys.next ? 1 : event.key === keys.previous ? -1 : 0;
    if (step === 0 || books.length === 0) return;
    event.preventDefault();
    const index = books.findIndex((book) => book.id === selected?.id);
    const next = books[Math.min(books.length - 1, Math.max(0, index + step))];
    if (next) dispatch({ type: "selectBook", bookId: next.id });
  };
};

function StatusCell({ book }: { book: Book }) {
  const { today } = useLibrary();
  const t = useT();
  const loan = loanState(book, today);
  return (
    <span className="flex gap-1">
      {loan.kind !== "none" && (
        <HandHelping
          size={16}
          role="img"
          aria-label={loan.kind === "overdue" ? t.loans.overdueTo(loan.borrower) : t.loans.lentTo(loan.borrower)}
          className={loan.kind === "overdue" ? "text-danger" : "text-tone-loan"}
        />
      )}
      {book.readStatus === "reading" && (
        <BookMarked size={16} role="img" aria-label={t.readStatus.reading} className="text-accent" />
      )}
    </span>
  );
}

const cellText = (book: Book, column: Exclude<ColumnKey, "rating">, t: Messages, locale: string) => {
  switch (column) {
    case "title":
      return book.title;
    case "authors":
      return book.authors.join(", ");
    case "genres":
      return book.genres.join(", ");
    case "readStatus":
      return t.readStatus[book.readStatus];
    case "series":
      return book.series ? `${book.series}${book.seriesNumber ? ` ${book.seriesNumber}` : ""}` : "";
    case "addedAt":
      return new Date(book.addedAt).toLocaleDateString(locale);
    case "publisher":
    case "location":
      return book[column] ?? "";
    case "publishedYear":
    case "pages":
      return book[column]?.toString() ?? "";
  }
};

function ColumnPicker() {
  const { columns, dispatch } = useLibrary();
  const t = useT();
  return (
    <details className="relative">
      <summary className="flex h-8 touch:h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink-soft">
        <Columns3 size={15} aria-hidden="true" />
        {t.library.columns}
      </summary>
      <fieldset className="absolute right-0 z-20 mt-1 flex w-48 flex-col gap-1 rounded-lg border border-line bg-surface p-2 text-sm shadow-lg">
        <legend className="sr-only">{t.library.visibleColumns}</legend>
        {columnKeys.map((column) => (
          <label key={column} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-chip touch:py-2">
            <input
              type="checkbox"
              checked={columns.includes(column)}
              disabled={column === "title"}
              onChange={() => dispatch({ type: "toggleColumn", column })}
              className="accent-(--accent)"
            />
            {t.columns[column]}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

const filterField = (active: boolean) =>
  `h-7 w-full min-w-0 rounded-md border px-1.5 text-xs text-ink outline-none placeholder:font-normal placeholder:text-muted focus:border-accent touch:h-9 ${
    active ? "border-accent bg-selected font-medium" : "border-line bg-surface font-normal"
  }`;

// Un campo sotto ogni intestazione: testo per le colonne di parole, numeri con >, < e intervalli, menu per voto e lettura.
function ColumnFilter({ column }: { column: ColumnKey }) {
  const { state, dispatch } = useLibrary();
  const t = useT();
  const value = state.columnFilters[column] ?? "";
  const label = t.library.columnFilters.label(t.columns[column]);
  const set = (next: string) => dispatch({ type: "setColumnFilter", column, value: next });
  const className = filterField(value !== "");
  switch (column) {
    case "rating":
      return (
        <select aria-label={label} value={value} onChange={(event) => set(event.target.value)} className={className}>
          <option value="">{t.library.columnFilters.any}</option>
          {[1, 2, 3, 4, 5].map((stars) => (
            <option key={stars} value={String(stars)}>
              {t.library.columnFilters.atLeast(stars)}
            </option>
          ))}
          <option value={unratedFilter}>{t.library.columnFilters.unrated}</option>
        </select>
      );
    case "readStatus":
      return (
        <select aria-label={label} value={value} onChange={(event) => set(event.target.value)} className={className}>
          <option value="">{t.library.columnFilters.any}</option>
          {readStatuses.map((status) => (
            <option key={status} value={status}>
              {t.readStatus[status]}
            </option>
          ))}
        </select>
      );
    default: {
      const numeric = column === "publishedYear" || column === "pages";
      return (
        <input
          type="search"
          value={value}
          onChange={(event) => set(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") set("");
          }}
          aria-label={label}
          title={numeric ? t.library.columnFilters.numberHint : undefined}
          placeholder={numeric ? t.library.columnFilters.numberPlaceholder : t.library.columnFilters.placeholder}
          className={className}
        />
      );
    }
  }
}

export function BookTable() {
  const { books, columns, sort, selected, state, dispatch } = useLibrary();
  const { t, locale } = useI18n();
  const bookDrag = useBookDrag();
  const onArrow = useArrowSelection();
  const primary = sort[0];
  const filtering = hasColumnFilters(state.columnFilters, columns);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex justify-end gap-2 px-5 pb-2">
        {filtering && (
          <button
            type="button"
            onClick={() => columns.forEach((column) => dispatch({ type: "setColumnFilter", column, value: "" }))}
            className="flex h-8 touch:h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink-soft"
          >
            <FilterX size={15} aria-hidden="true" />
            {t.library.columnFilters.clear}
          </button>
        )}
        <ColumnPicker />
      </div>
      <div
        tabIndex={0}
        aria-label={t.library.bookListHint}
        onKeyDown={(event) => onArrow(event, { previous: "ArrowUp", next: "ArrowDown" })}
        className="min-h-0 flex-1 overflow-auto px-3 outline-none"
      >
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead className="sticky top-0 bg-bg text-left text-xs text-muted">
            <tr>
              <th className="w-9 border-b border-line p-2">
                <span className="sr-only">{t.library.status}</span>
              </th>
              {columns.map((column) => {
                const active = primary?.column === column;
                const Arrow = primary?.direction === "desc" ? ArrowDown : ArrowUp;
                return (
                  <th
                    key={column}
                    aria-sort={active ? (primary.direction === "asc" ? "ascending" : "descending") : undefined}
                    className="border-b border-line p-0 font-semibold"
                  >
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "sortBy", column })}
                      className={`flex w-full items-center gap-1 p-2 text-left ${active ? "text-ink" : ""}`}
                    >
                      {t.columns[column]}
                      {active && <Arrow size={12} aria-hidden="true" />}
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="border-b border-line px-2 pb-2" aria-hidden="true" />
              {columns.map((column) => (
                <th key={column} className="border-b border-line px-1 pt-0 pb-2">
                  <ColumnFilter column={column} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {books.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-10 text-center text-muted">
                  {t.library.columnFilters.noMatches}
                </td>
              </tr>
            )}
            {books.map((book) => (
              <tr
                key={book.id}
                aria-selected={book.id === selected?.id}
                {...bookDrag(book)}
                onClick={() => dispatch({ type: "selectBook", bookId: book.id })}
                className={`cursor-default ${book.id === selected?.id ? "bg-selected" : "hover:bg-chip/60"}`}
              >
                <td className="border-b border-line/70 px-2 py-2.5 touch:py-3.5">
                  <StatusCell book={book} />
                </td>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={`border-b border-line/70 px-2 py-2.5 touch:py-3.5 ${
                      column === "title" ? "font-medium" : "text-ink-soft"
                    } ${column === "publishedYear" || column === "pages" ? "tabular-nums" : ""}`}
                  >
                    {column === "rating" ? <Rating rating={book.rating} /> : cellText(book, column, t, locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BookGrid() {
  const { books, selected, state, today, dispatch } = useLibrary();
  const bookDrag = useBookDrag();
  return (
    <ul
      className="grid content-start gap-x-5 gap-y-7 overflow-auto px-6 pb-6"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${state.coverSize}px, 1fr))` }}
    >
      {books.map((book) => (
        <li key={book.id}>
          <button
            type="button"
            aria-pressed={book.id === selected?.id}
            {...bookDrag(book)}
            onClick={() => dispatch({ type: "selectBook", bookId: book.id })}
            className="flex w-full flex-col gap-2 text-left"
          >
            <Cover
              book={book}
              loan={loanState(book, today)}
              size={state.coverSize < 120 ? "sm" : "md"}
              className={book.id === selected?.id ? "outline-3 outline-offset-3 outline-accent" : ""}
            />
            <span>
              <span className="block text-[13px] leading-snug font-semibold">{book.title}</span>
              <span className="block text-xs text-muted">{book.authors.join(", ")}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function BookCarousel() {
  const { books, selected, today, dispatch } = useLibrary();
  const t = useT();
  const bookDrag = useBookDrag();
  const onArrow = useArrowSelection();
  const track = useRef<HTMLUListElement>(null);
  const index = books.findIndex((book) => book.id === selected?.id);
  const move = (step: number) => {
    const next = books[Math.min(books.length - 1, Math.max(0, (index < 0 ? 0 : index) + step))];
    if (next) dispatch({ type: "selectBook", bookId: next.id });
  };

  // Tiene il libro selezionato al centro.
  useEffect(() => {
    track.current
      ?.querySelector<HTMLElement>(`[data-book="${selected?.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected?.id]);

  return (
    <section
      aria-label={t.library.carousel}
      tabIndex={0}
      onKeyDown={(event) => onArrow(event, { previous: "ArrowLeft", next: "ArrowRight" })}
      className="relative flex h-[340px] shrink-0 items-center border-b border-line bg-panel outline-none"
    >
      <button
        type="button"
        aria-label={t.library.previousBook}
        onClick={() => move(-1)}
        className="absolute left-4 z-10 flex size-10 touch:size-12 items-center justify-center rounded-full bg-chip text-ink"
      >
        <ChevronLeft size={18} />
      </button>
      <ul ref={track} className="flex h-full w-full snap-x snap-mandatory items-center gap-5 overflow-x-auto px-[50%] [scrollbar-width:none]">
        {books.map((book) => {
          const active = book.id === selected?.id;
          return (
            <li key={book.id} data-book={book.id} className="shrink-0 snap-center">
              <button
                type="button"
                aria-pressed={active}
                aria-label={book.title}
                {...bookDrag(book)}
                onClick={() => dispatch({ type: "selectBook", bookId: book.id })}
                className={`block transition-all duration-200 ${active ? "w-[180px]" : "w-[130px] opacity-60 hover:opacity-90"}`}
              >
                <Cover
                  book={book}
                  loan={loanState(book, today)}
                  size={active ? "lg" : "md"}
                  className={active ? "outline-2 outline-accent" : ""}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        aria-label={t.library.nextBook}
        onClick={() => move(1)}
        className="absolute right-4 z-10 flex size-10 touch:size-12 items-center justify-center rounded-full bg-chip text-ink"
      >
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

export function EmptyState() {
  const { state, collection, dispatch, canEdit } = useLibrary();
  const t = useT();
  const filtered = state.query !== "" || state.valueFilter !== null;
  // Una collezione vuota spiega come riempirla.
  const fillable = !filtered && canEdit && collection?.kind === "regular";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-muted">
      <p>{filtered ? t.library.noMatches : t.library.emptyCollection}</p>
      {fillable && <p className="max-w-sm text-sm">{t.collections.search.emptyHint}</p>}
      {fillable && <CollectionSearchButton />}
      {filtered && (
        <button
          type="button"
          onClick={() => dispatch({ type: "clearFilters" })}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-ink"
        >
          {t.library.showAll}
        </button>
      )}
    </div>
  );
}
