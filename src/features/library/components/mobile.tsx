"use client";

import { ArrowLeft, ChartColumn, ChevronDown, ChevronRight, HandHelping, Library, ScanBarcode, BookCopy } from "lucide-react";
import type { ReactNode } from "react";
import { loanState } from "../query";
import { BookDetails } from "./book-details";
import { Cover, loanBanner } from "./cover";
import { useLibrary } from "./library-context";
import { AccountMenu } from "./account-menu";
import { Logo } from "./logo";
import { Rating } from "./rating";
import { Sidebar } from "./sidebar";
import { SearchBox } from "./toolbar";

// Scorciatoie in cima alla lista: collezioni speciali e libri in lettura.
function QuickFilters() {
  const { state, dispatch, counts } = useLibrary();
  const reading = state.library.books.filter((book) => book.readStatus === "reading" && !book.wishlist).length;
  const isReading = state.valueFilter?.field === "readStatus" && state.valueFilter.value === "reading";
  const chips = [
    { label: "Tutti", count: counts.library, active: state.collectionId === "library" && !isReading, onClick: () => dispatch({ type: "selectCollection", collectionId: "library" }) },
    {
      label: "In lettura",
      count: reading,
      active: isReading,
      onClick: () => {
        dispatch({ type: "selectCollection", collectionId: "library" });
        dispatch({ type: "setValueFilter", filter: { field: "readStatus", value: "reading" } });
      },
    },
    { label: "In prestito", count: counts.loaned, active: state.collectionId === "loaned", onClick: () => dispatch({ type: "selectCollection", collectionId: "loaned" }) },
    { label: "Desideri", count: counts.wishlist, active: state.collectionId === "wishlist", onClick: () => dispatch({ type: "selectCollection", collectionId: "wishlist" }) },
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          aria-pressed={chip.active}
          onClick={chip.onClick}
          className={`h-[34px] shrink-0 rounded-full px-3.5 text-[13px] ${
            chip.active ? "bg-ink font-semibold text-bg" : "border border-line-strong text-ink-soft"
          }`}
        >
          {chip.label} {chip.count}
        </button>
      ))}
    </div>
  );
}

function BookRows() {
  const { books, today, dispatch } = useLibrary();
  if (books.length === 0) return <p className="p-8 text-center text-muted">Nessun libro qui.</p>;
  return (
    <ul className="px-4">
      {books.map((book) => {
        const loan = loanState(book, today);
        const banner = loanBanner(loan);
        return (
          <li key={book.id} className="border-b border-line/70">
            <button
              type="button"
              onClick={() => dispatch({ type: "openBook", bookId: book.id })}
              className="flex w-full items-center gap-3 py-2.5 text-left"
            >
              <Cover book={book} size="xs" className="w-11 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{book.title}</span>
                <span className="text-[13px] text-muted">{book.authors.join(", ")}</span>
                <span className="flex items-center gap-2 text-xs">
                  <Rating rating={book.rating} size={12} />
                  {banner && (
                    <span
                      className={`rounded-full px-1.5 font-semibold ${
                        banner.tone === "danger" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"
                      }`}
                    >
                      {loan.kind === "due" ? `${loan.borrower}, ${loan.daysLeft} gg` : banner.text}
                    </span>
                  )}
                  {book.readStatus === "reading" && (
                    <span className="rounded-full bg-selected px-1.5 font-semibold text-accent">In lettura</span>
                  )}
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TabBar() {
  const { state, dispatch } = useLibrary();
  const tab = (label: string, icon: ReactNode, active: boolean, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 text-[11px] disabled:opacity-50 ${active ? "font-semibold text-accent" : "text-muted"}`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <nav aria-label="Sezioni" className="grid grid-cols-4 border-t border-line bg-bg px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
      {tab("Libreria", <Library size={22} aria-hidden="true" />, state.mobileScreen === "list" && state.collectionId === "library", () =>
        dispatch({ type: "selectCollection", collectionId: "library" }),
      )}
      {tab("Collezioni", <BookCopy size={22} aria-hidden="true" />, state.mobileScreen === "collections", () =>
        dispatch({ type: "setMobileScreen", screen: "collections" }),
      )}
      {tab("Prestiti", <HandHelping size={22} aria-hidden="true" />, state.mobileScreen === "list" && state.collectionId === "loaned", () =>
        dispatch({ type: "selectCollection", collectionId: "loaned" }),
      )}
      {tab("Statistiche", <ChartColumn size={22} aria-hidden="true" />, false)}
    </nav>
  );
}

// D: una schermata alla volta, pensata per il telefono.
export function MobileShell({ onLend }: { onLend: () => void }) {
  const { state, collection, selected, dispatch, canEdit } = useLibrary();

  if (state.mobileScreen === "book" && selected) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-2 border-b border-line px-2 py-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "setMobileScreen", screen: "list" })}
            className="flex h-11 items-center gap-1 rounded-lg px-2 text-accent"
          >
            <ArrowLeft size={20} aria-hidden="true" />
            {collection?.name}
          </button>
        </header>
        <BookDetails book={selected} variant="page" onLend={onLend} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {state.mobileScreen === "collections" ? (
        <div className="flex-1">
          <h1 className="px-4 pt-5 pb-2 text-[26px] font-bold">Collezioni</h1>
          <Sidebar className="w-full bg-transparent" />
        </div>
      ) : (
        <>
          <header className="flex flex-col gap-3 px-4 pt-5 pb-2.5">
            <div className="flex items-center gap-2.5">
              <Logo size={40} />
              <button
                type="button"
                onClick={() => dispatch({ type: "setMobileScreen", screen: "collections" })}
                className="flex items-center gap-1 font-display text-[26px] font-bold"
              >
                {collection?.name}
                <ChevronDown size={20} className="text-muted" aria-hidden="true" />
              </button>
              <div className="ml-auto">
                <AccountMenu />
              </div>
            </div>
            <SearchBox className="h-11 rounded-xl border-0 bg-chip" />
            <QuickFilters />
          </header>
          <main className="flex-1 pb-24">
            <BookRows />
          </main>
          {canEdit && (
            <button
              type="button"
              aria-label="Scansiona ISBN"
              title="In arrivo"
              disabled
              className="fixed right-4 bottom-24 flex size-15 items-center justify-center rounded-[20px] bg-accent text-accent-ink shadow-[0_10px_24px_rgba(47,91,211,0.35)] disabled:opacity-80"
            >
              <ScanBarcode size={26} />
            </button>
          )}
        </>
      )}
      <div className="sticky bottom-0">
        <TabBar />
      </div>
    </div>
  );
}
