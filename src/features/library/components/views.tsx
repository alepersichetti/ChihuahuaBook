"use client";

import { ArrowDown, ArrowUp, BookMarked, ChevronLeft, ChevronRight, Columns3, HandHelping } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Messages } from "../../i18n/messages";
import { useI18n, useT } from "../../i18n/i18n-context";
import { columnKeys, type Book, type ColumnKey } from "../model";
import { loanState } from "../query";
import { Cover } from "./cover";
import { useLibrary } from "./library-context";
import { Rating } from "./rating";

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
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink-soft">
        <Columns3 size={15} aria-hidden="true" />
        {t.library.columns}
      </summary>
      <fieldset className="absolute right-0 z-20 mt-1 flex w-48 flex-col gap-1 rounded-lg border border-line bg-surface p-2 text-sm shadow-lg">
        <legend className="sr-only">{t.library.visibleColumns}</legend>
        {columnKeys.map((column) => (
          <label key={column} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-chip">
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

export function BookTable() {
  const { books, columns, sort, selected, dispatch } = useLibrary();
  const { t, locale } = useI18n();
  const onArrow = useArrowSelection();
  const primary = sort[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex justify-end px-5 pb-2">
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
          </thead>
          <tbody>
            {books.map((book) => (
              <tr
                key={book.id}
                aria-selected={book.id === selected?.id}
                onClick={() => dispatch({ type: "selectBook", bookId: book.id })}
                className={`cursor-default ${book.id === selected?.id ? "bg-selected" : "hover:bg-chip/60"}`}
              >
                <td className="border-b border-line/70 px-2 py-2.5">
                  <StatusCell book={book} />
                </td>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={`border-b border-line/70 px-2 py-2.5 ${
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
        className="absolute left-4 z-10 flex size-10 items-center justify-center rounded-full bg-chip text-ink"
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
        className="absolute right-4 z-10 flex size-10 items-center justify-center rounded-full bg-chip text-ink"
      >
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

export function EmptyState() {
  const { state, dispatch } = useLibrary();
  const t = useT();
  const filtered = state.query !== "" || state.valueFilter !== null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-muted">
      <p>{filtered ? t.library.noMatches : t.library.emptyCollection}</p>
      {filtered && (
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "setQuery", query: "" });
            dispatch({ type: "setValueFilter", filter: null });
          }}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-ink"
        >
          {t.library.showAll}
        </button>
      )}
    </div>
  );
}
