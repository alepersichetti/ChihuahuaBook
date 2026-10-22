"use client";

import { X } from "lucide-react";
import { plural, valueFilterLabel } from "../labels";
import { loanState } from "../query";
import { useSettings } from "../../settings/settings-context";
import { coverSizes } from "../state";
import { BookDetails } from "./book-details";
import { useLibrary } from "./library-context";
import { Sidebar } from "./sidebar";
import { Toolbar } from "./toolbar";
import { BookCarousel, BookGrid, BookTable, EmptyState } from "./views";

function FilterChip() {
  const { state, dispatch } = useLibrary();
  if (!state.valueFilter) return null;
  const { field, value } = state.valueFilter;
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "setValueFilter", filter: null })}
      className="flex items-center gap-1.5 rounded-full bg-selected py-1 pr-2 pl-3 text-xs font-medium"
    >
      {valueFilterLabel[field]}: {value}
      <X size={13} aria-label="Togli filtro" />
    </button>
  );
}

function MainHeader() {
  const { collection, books } = useLibrary();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4 pb-3">
      <h1 className="font-display text-xl font-bold">
        {collection?.name}
      </h1>
      <span className="text-muted">{plural(books.length, "libro", "libri")}</span>
      <FilterChip />
    </div>
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
  const loans = books.map((book) => loanState(book, today));
  const loaned = loans.filter((loan) => loan.kind !== "none").length;
  const late = loans.filter((loan) => loan.kind === "overdue").length;
  return (
    <footer className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted">
      <span>{plural(books.length, "libro", "libri")}</span>
      {loaned > 0 && <span>{loaned} in prestito</span>}
      {late > 0 && <span className="font-semibold text-danger">{late} in ritardo</span>}
      {view === "grid" && (
        <label className="ml-auto flex items-center gap-2">
          Dimensione copertine
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
  return (
    <aside className="flex w-[340px] shrink-0 items-center justify-center border-l border-line p-8 text-center text-sm text-muted">
      Seleziona un libro per vederne i dettagli.
    </aside>
  );
}

type ShellProps = { readonly onLend: () => void };

// A e B: collezioni, libri e dettagli affiancati. B cambia solo la vista iniziale (copertine).
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

// C: tema scuro, carosello in alto e dettaglio sotto, come Bookpedia.
function ShelfShell({ onLend }: ShellProps) {
  const { state, selected, view } = useLibrary();
  return (
    <>
      <Toolbar onLend={onLend} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          {view !== "carousel" && <MainHeader />}
          <div className={view === "carousel" ? "contents" : "flex min-h-0 flex-1 flex-col"}>
            <BooksView />
          </div>
          {state.detailsOpen && selected && (
            <div className={`border-t border-line ${view === "carousel" ? "min-h-0 flex-1 overflow-auto" : "max-h-[45%] overflow-auto"}`}>
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
  const { state } = useLibrary();
  switch (state.layout) {
    case "classic":
    case "gallery":
      return <ClassicShell onLend={onLend} />;

    case "shelf":
      return <ShelfShell onLend={onLend} />;
  }
}
