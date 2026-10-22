"use client";

import { ArrowLeft, ChartColumn, ChevronDown, ChevronRight, HandHelping, Library, Plus, BookCopy, Settings } from "lucide-react";
import { useT } from "../../i18n/i18n-context";
import { useSettings } from "../../settings/settings-context";
import { collectionName } from "../labels";
import type { ReactNode } from "react";
import { loanState } from "../query";
import { BookDetails } from "./book-details";
import { CollectionSearch, CollectionSearchButton } from "./collection-search";
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
  const t = useT();
  const reading = state.library.books.filter((book) => book.readStatus === "reading" && !book.wishlist).length;
  const isReading = state.valueFilter?.field === "readStatus" && state.valueFilter.value === "reading";
  const chips = [
    { label: t.mobile.all, count: counts.library, active: state.collectionId === "library" && !isReading, onClick: () => dispatch({ type: "selectCollection", collectionId: "library" }) },
    {
      label: t.readStatus.reading,
      count: reading,
      active: isReading,
      onClick: () => {
        dispatch({ type: "selectCollection", collectionId: "library" });
        dispatch({ type: "setValueFilter", filter: { field: "readStatus", value: "reading" } });
      },
    },
    { label: t.collections.system.loaned, count: counts.loaned, active: state.collectionId === "loaned", onClick: () => dispatch({ type: "selectCollection", collectionId: "loaned" }) },
    { label: t.mobile.wishlist, count: counts.wishlist, active: state.collectionId === "wishlist", onClick: () => dispatch({ type: "selectCollection", collectionId: "wishlist" }) },
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
  const t = useT();
  if (books.length === 0) return <p className="p-8 text-center text-muted">{t.mobile.noBooks}</p>;
  return (
    <ul className="px-4">
      {books.map((book) => {
        const loan = loanState(book, today);
        const banner = loanBanner(loan, t);
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
                      {loan.kind === "due" ? t.loans.dueShort(loan.borrower, loan.daysLeft) : banner.text}
                    </span>
                  )}
                  {book.readStatus === "reading" && (
                    <span className="rounded-full bg-selected px-1.5 font-semibold text-accent">{t.readStatus.reading}</span>
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
  const { canOpen, openPanel } = useSettings();
  const t = useT();
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
    <nav aria-label={t.mobile.sections} className={`grid ${canOpen ? "grid-cols-5" : "grid-cols-4"} border-t border-line bg-bg px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]`}>
      {tab(t.collections.system.library, <Library size={22} aria-hidden="true" />, state.mobileScreen === "list" && state.collectionId === "library", () =>
        dispatch({ type: "selectCollection", collectionId: "library" }),
      )}
      {tab(t.collections.title, <BookCopy size={22} aria-hidden="true" />, state.mobileScreen === "collections", () =>
        dispatch({ type: "setMobileScreen", screen: "collections" }),
      )}
      {tab(t.mobile.loans, <HandHelping size={22} aria-hidden="true" />, state.mobileScreen === "list" && state.collectionId === "loaned", () =>
        dispatch({ type: "selectCollection", collectionId: "loaned" }),
      )}
      {tab(t.library.statistics, <ChartColumn size={22} aria-hidden="true" />, false)}
      {canOpen && tab(t.settings.title, <Settings size={22} aria-hidden="true" />, false, openPanel)}
    </nav>
  );
}

// D: una schermata alla volta, pensata per il telefono.
export function MobileShell({ onLend }: { onLend: () => void }) {
  const { state, collection, selected, dispatch, canEdit } = useLibrary();
  const t = useT();
  const name = collection ? collectionName(collection, t) : "";

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
            {name}
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
          <h1 className="px-4 pt-5 pb-2 text-[26px] font-bold">{t.collections.title}</h1>
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
                {name}
                <ChevronDown size={20} className="text-muted" aria-hidden="true" />
              </button>
              <div className="ml-auto">
                <AccountMenu />
              </div>
            </div>
            <SearchBox className="h-11 rounded-xl border-0 bg-chip" />
            <QuickFilters />
            <CollectionSearchButton className="self-start" />
            <CollectionSearch />
          </header>
          <main className="flex-1 pb-24">
            <BookRows />
          </main>
          {canEdit && (
            <button
              type="button"
              aria-label={t.addBook.title}
              onClick={() => dispatch({ type: "setAddOpen", open: true })}
              className="fixed right-4 bottom-24 flex size-15 items-center justify-center rounded-[20px] bg-accent text-accent-ink shadow-[0_10px_24px_rgba(47,91,211,0.35)] disabled:opacity-80"
            >
              <Plus size={26} />
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
