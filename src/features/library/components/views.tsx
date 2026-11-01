"use client";

import { ArrowDown, ArrowUp, BookMarked, ChevronLeft, ChevronRight, Columns3, HandHelping } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Messages } from "../../i18n/messages";
import { useI18n, useT } from "../../i18n/i18n-context";
import { columnKeys, type Book, type ColumnKey } from "../model";
import { loanState, type LoanState } from "../query";
import { chunk, gridColumns } from "../virtual-range";
import { Cover } from "./cover";
import { CollectionSearchButton } from "./collection-search";
import { draggableBook } from "./drag";
import { useLibrary } from "./library-context";
import { useFinePointer, useWide } from "./media";
import { Rating } from "./rating";
import { useTouchDragSource } from "./touch-drag";
import { useVirtualList } from "./virtual";

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

// Larghezze fisse: con la tabella virtualizzata le colonne non devono dipendere dalle righe visibili.
const columnWidth: Partial<Record<ColumnKey, string>> = {
  authors: "22%",
  publishedYear: "4.5rem",
  genres: "16%",
  rating: "6.5rem",
  readStatus: "7rem",
  series: "14%",
  addedAt: "6.5rem",
  publisher: "16%",
  pages: "4.5rem",
  location: "12%",
};

const BookRow = memo(function BookRow({
  book,
  columns,
  selected,
  rowRef,
}: {
  book: Book;
  columns: readonly ColumnKey[];
  selected: boolean;
  rowRef?: (element: HTMLElement | null) => void;
}) {
  const { dispatch } = useLibrary();
  const { t, locale } = useI18n();
  const bookDrag = useBookDrag();
  return (
    <tr
      ref={rowRef}
      aria-selected={selected}
      {...bookDrag(book)}
      onClick={() => dispatch({ type: "selectBook", bookId: book.id })}
      className={`cursor-default ${selected ? "bg-selected" : "hover:bg-chip/60"}`}
    >
      <td className="border-b border-line/70 px-2 py-2.5 touch:py-3.5">
        <StatusCell book={book} />
      </td>
      {columns.map((column) => {
        const text = column === "rating" ? null : cellText(book, column, t, locale);
        return (
          <td
            key={column}
            title={text ?? undefined}
            className={`truncate border-b border-line/70 px-2 py-2.5 touch:py-3.5 ${
              column === "title" ? "font-medium" : "text-ink-soft"
            } ${column === "publishedYear" || column === "pages" ? "tabular-nums" : ""}`}
          >
            {column === "rating" ? <Rating rating={book.rating} /> : text}
          </td>
        );
      })}
    </tr>
  );
});

// Tiene in vista il libro scelto con le frecce, anche se era fuori dalla parte disegnata.
const useKeepSelectedVisible = (scrollToIndex: (index: number) => void) => {
  const { books, selected } = useLibrary();
  const index = selected ? books.findIndex((book) => book.id === selected.id) : -1;
  useEffect(() => {
    if (index >= 0) scrollToIndex(index);
  }, [index, scrollToIndex]);
};

export function BookTable() {
  const { books, columns, sort, selected, dispatch } = useLibrary();
  const t = useT();
  const onArrow = useArrowSelection();
  const primary = sort[0];
  const scroller = useRef<HTMLDivElement>(null);
  const { setList, measureItem, scrollToIndex, start, end, before, after } = useVirtualList<HTMLTableSectionElement>({ count: books.length, estimate: 41, scrollRef: scroller });
  useKeepSelectedVisible(scrollToIndex);
  const span = columns.length + 1;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex justify-end px-5 pb-2">
        <ColumnPicker />
      </div>
      <div
        ref={scroller}
        tabIndex={0}
        aria-label={t.library.bookListHint}
        onKeyDown={(event) => onArrow(event, { previous: "ArrowUp", next: "ArrowDown" })}
        className="min-h-0 flex-1 overflow-auto px-3 outline-none"
      >
        <table aria-rowcount={books.length + 1} className="w-full min-w-[620px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-9" />
            {columns.map((column) => (
              <col key={column} style={{ width: columnWidth[column] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-bg text-left text-xs text-muted">
            <tr>
              <th className="border-b border-line p-2">
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
                      <span className="truncate">{t.columns[column]}</span>
                      {active && <Arrow size={12} className="shrink-0" aria-hidden="true" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={setList}>
            {before > 0 && (
              <tr aria-hidden="true">
                <td colSpan={span} style={{ height: before, padding: 0 }} />
              </tr>
            )}
            {books.slice(start, end).map((book, index) => (
              <BookRow
                key={book.id}
                book={book}
                columns={columns}
                selected={book.id === selected?.id}
                rowRef={index === 0 ? measureItem : undefined}
              />
            ))}
            {after > 0 && (
              <tr aria-hidden="true">
                <td colSpan={span} style={{ height: after, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const GridItem = memo(function GridItem({
  book,
  selected,
  coverSize,
  loan,
}: {
  book: Book;
  selected: boolean;
  coverSize: number;
  loan: LoanState;
}) {
  const { dispatch } = useLibrary();
  const bookDrag = useBookDrag();
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        {...bookDrag(book)}
        onClick={() => dispatch({ type: "selectBook", bookId: book.id })}
        className="flex w-full flex-col gap-2 text-left"
      >
        <Cover
          book={book}
          loan={loan}
          size={coverSize < 120 ? "sm" : "md"}
          className={selected ? "outline-3 outline-offset-3 outline-accent" : ""}
        />
        <span>
          <span className="line-clamp-2 h-[2lh] text-[13px] leading-snug font-semibold">{book.title}</span>
          <span className="block truncate text-xs text-muted">{book.authors.join(", ")}</span>
        </span>
      </button>
    </li>
  );
});

// Spazi della griglia: gap-x-5 e gap-y-7, padding px-6.
const gridGap = { x: 20, y: 28, padding: 24 };

export function BookGrid() {
  const { books, selected, state, today } = useLibrary();
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth - gridGap.padding * 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const columns = gridColumns(width, state.coverSize, gridGap.x);
  const rowsOfBooks = useMemo(() => chunk(books, columns), [books, columns]);
  const { setList, measureItem, scrollToIndex, start, end, before, after } = useVirtualList<HTMLDivElement>({
    count: rowsOfBooks.length,
    estimate: state.coverSize * 1.5 + 60,
    gap: gridGap.y,
    overscan: 3,
    scrollRef: scroller,
  });
  useKeepSelectedVisible(
    useCallback((index: number) => scrollToIndex(Math.floor(index / columns)), [scrollToIndex, columns]),
  );
  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto px-6 pb-6">
      <div ref={setList} style={{ paddingTop: before, paddingBottom: after }}>
        {rowsOfBooks.slice(start, end).map((row, index) => (
          <ul
            key={start + index}
            ref={index === 0 ? measureItem : undefined}
            className="grid gap-x-5"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              marginBottom: gridGap.y,
            }}
          >
            {row.map((book) => (
              <GridItem
                key={book.id}
                book={book}
                selected={book.id === selected?.id}
                coverSize={state.coverSize}
                loan={loanState(book, today)}
              />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

// Galleria: copertine da 130 px distanziate di 20 (quella scelta è più larga).
const carousel = { item: 150 };

export function BookCarousel() {
  const { books, selected, today, dispatch } = useLibrary();
  const t = useT();
  const bookDrag = useBookDrag();
  const onArrow = useArrowSelection();
  const track = useRef<HTMLDivElement>(null);
  const index = books.findIndex((book) => book.id === selected?.id);
  const { setList, drawAround, start, end, before, after } = useVirtualList<HTMLUListElement>({
    count: books.length,
    estimate: carousel.item,
    fixedSize: carousel.item,
    axis: "x",
    overscan: 8,
    scrollRef: track,
  });
  const move = (step: number) => {
    const next = books[Math.min(books.length - 1, Math.max(0, (index < 0 ? 0 : index) + step))];
    if (next) dispatch({ type: "selectBook", bookId: next.id });
  };

  // Tiene il libro selezionato al centro. Se non è ancora disegnato lo si disegna prima:
  // con lo scorrimento "a scatti" il browser si fermerebbe sull'ultima copertina presente.
  const pending = useRef(false);
  useEffect(() => {
    if (index < 0) return;
    const drawn = track.current?.querySelector<HTMLElement>(`[data-book="${CSS.escape(selected?.id ?? "")}"]`);
    if (drawn) {
      drawn.scrollIntoView({ behavior: pending.current ? "instant" : "smooth", inline: "center", block: "nearest" });
      pending.current = false;
    } else if (!pending.current) {
      pending.current = true;
      drawAround(index);
    }
  }, [index, selected?.id, start, drawAround]);

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
      <div ref={track} className="flex h-full w-full snap-x snap-mandatory items-center overflow-x-auto px-[50%] [scrollbar-width:none]">
        <ul
          ref={setList}
          className="flex shrink-0 items-center gap-5"
          style={{ paddingLeft: before, paddingRight: after }}
        >
          {books.slice(start, end).map((book) => {
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
      </div>
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
