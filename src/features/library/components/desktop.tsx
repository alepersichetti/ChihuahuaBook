"use client";

import { X } from "lucide-react";
import { useT } from "../../i18n/i18n-context";
import { collectionName } from "../labels";
import { loanState } from "../query";
import { useSettings } from "../../settings/settings-context";
import { coverSizes } from "../state";
import { BookDetails } from "./book-details";
import { CollectionSearch, CollectionSearchButton } from "./collection-search";
import { useLibrary } from "./library-context";
import { Sidebar } from "./sidebar";
import { Toolbar } from "./toolbar";
import { BookCarousel, BookGrid, BookTable, EmptyState } from "./views";

function FilterChip() {
  const { state, dispatch } = useLibrary();
  const t = useT();
  if (!state.valueFilter) return null;
  const { field, value } = state.valueFilter;
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "setValueFilter", filter: null })}
      className="flex items-center gap-1.5 rounded-full bg-selected py-1 pr-2 pl-3 text-xs font-medium"
    >
      {t.fields[field]}: {value}
      <X size={13} aria-label={t.library.removeFilter} />
    </button>
  );
}

function MainHeader() {
  const { collection, books } = useLibrary();
  const t = useT();
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4 pb-3">
        <h1 className="font-display text-xl font-bold">
          {collection && collectionName(collection, t)}
        </h1>
        <span className="text-muted">{t.library.books(books.length)}</span>
        <FilterChip />
        <CollectionSearchButton className="ml-auto" />
      </div>
      <CollectionSearch className="mx-5 mb-3" />
    </>
  );
}

function BooksView() {
  const { view, books } = useLibrary();
  if (books.length === 0) return <EmptyState />;
  switch (view) {
    case "list":
      return <BookTable />;
    case "grid":
      return <BookGrid />;
    case "carousel":
      return <BookCarousel />;
  }
}

function StatusBar() {
  const { books, today, view } = useLibrary();
  const { preferences, setPreference } = useSettings();
  const t = useT();
  const loans = books.map((book) => loanState(book, today));
  const loaned = loans.filter((loan) => loan.kind !== "none").length;
  const late = loans.filter((loan) => loan.kind === "overdue").length;
  return (
    <footer className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted">
      <span>{t.library.books(books.length)}</span>
      {loaned > 0 && <span>{t.library.onLoan(loaned)}</span>}
      {late > 0 && <span className="font-semibold text-danger">{t.library.late(late)}</span>}
      {view === "grid" && (
        <label className="ml-auto flex items-center gap-2">
          {t.settings.coverSize}
          <input
            type="range"
            min={coverSizes.min}
            max={coverSizes.max}
            value={preferences.coverSize}
            onChange={(event) => setPreference("coverSize", Number(event.target.value))}
            className="w-36 accent-(--accent)"
          />
        </label>
      )}
    </footer>
  );
}

function NoSelection() {
  const t = useT();
  return (
    <aside className="flex w-[340px] shrink-0 items-center justify-center border-l border-line p-8 text-center text-sm text-muted">
      {t.library.noSelection}
    </aside>
  );
}

type ShellProps = { readonly onLend: () => void };

// Tabella e griglia: collezioni, libri e dettagli affiancati.
function ClassicShell({ onLend }: ShellProps) {
  const { state, selected } = useLibrary();
  return (
    <>
      <Toolbar onLend={onLend} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <MainHeader />
          <BooksView />
        </main>
        {state.detailsOpen &&
          (selected ? <BookDetails book={selected} variant="side" onLend={onLend} /> : <NoSelection />)}
      </div>
      <StatusBar />
    </>
  );
}

// Galleria: carosello in alto e scheda del libro nel riquadro sotto, senza pannello a destra.
function GalleryShell({ onLend }: ShellProps) {
  const { state, selected } = useLibrary();
  return (
    <>
      <Toolbar onLend={onLend} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <MainHeader />
          <BooksView />
          {state.detailsOpen && selected && (
            <div className="min-h-0 flex-1 overflow-auto border-t border-line">
              <BookDetails book={selected} variant="below" onLend={onLend} />
            </div>
          )}
        </main>
      </div>
      <StatusBar />
    </>
  );
}

export function DesktopShell({ onLend }: ShellProps) {
  const { view } = useLibrary();
  return view === "carousel" ? <GalleryShell onLend={onLend} /> : <ClassicShell onLend={onLend} />;
}
