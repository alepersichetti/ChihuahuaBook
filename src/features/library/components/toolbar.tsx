"use client";

import {
  GalleryHorizontal,
  HandHelping,
  LayoutGrid,
  List,
  ListPlus,
  type LucideIcon,
  PanelRight,
  Pencil,
  Plus,
  Search,
  Undo2,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { branding } from "@/config/branding";
import { useT } from "../../i18n/i18n-context";
import { collectionName } from "../labels";
import { layouts, searchFields, type Layout, type SearchField, type ViewMode } from "../model";
import { useSettings } from "../../settings/settings-context";
import { AccountMenu } from "./account-menu";
import { useLibrary } from "./library-context";
import { Logo } from "./logo";

const viewButtons: readonly { view: ViewMode; Icon: LucideIcon }[] = [
  { view: "list", Icon: List },
  { view: "grid", Icon: LayoutGrid },
  { view: "carousel", Icon: GalleryHorizontal },
];

const iconButton =
  "flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-chip disabled:opacity-40 disabled:hover:bg-transparent";

export function ViewSwitcher() {
  const { view, dispatch } = useLibrary();
  const t = useT();
  return (
    <div role="group" aria-label={t.views.label} className="flex gap-0.5 rounded-[10px] bg-chip p-[3px]">
      {viewButtons.map(({ view: mode, Icon }) => (
        <button
          key={mode}
          type="button"
          aria-label={t.views[mode]}
          aria-pressed={view === mode}
          onClick={() => dispatch({ type: "setView", view: mode })}
          className={`flex h-[30px] w-[34px] items-center justify-center rounded-[7px] ${
            view === mode ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function LayoutPicker() {
  const { preferences, setPreference } = useSettings();
  const t = useT();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only lg:not-sr-only">{t.settings.layout}</span>
      <select
        value={preferences.layout}
        onChange={(event) => setPreference("layout", event.target.value as Layout)}
        className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-ink"
      >
        {layouts.map((layout) => (
          <option key={layout} value={layout}>
            {t.layouts[layout]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchBox({ className = "" }: { className?: string }) {
  const { state, dispatch, collection } = useLibrary();
  const t = useT();
  const input = useRef<HTMLInputElement>(null);

  // "/" porta alla ricerca, come Cmd-Alt-F in Bookpedia.
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className={`flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-muted ${className}`}>
      <Search size={16} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        value={state.query}
        onChange={(event) => dispatch({ type: "setQuery", query: event.target.value })}
        placeholder={t.search.placeholder(collection ? collectionName(collection, t) : t.collections.system.library)}
        aria-label={t.search.label}
        className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
      />
      <select
        aria-label={t.search.field}
        value={state.searchField}
        onChange={(event) => dispatch({ type: "setSearchField", field: event.target.value as SearchField })}
        className="max-w-28 bg-transparent text-xs text-muted outline-none"
      >
        {searchFields.map((field) => (
          <option key={field} value={field}>
            {t.search.fields[field]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toolbar({ onLend }: { onLend: () => void }) {
  const { state, dispatch, selected, canEdit } = useLibrary();
  const t = useT();
  const loaned = selected?.loan != null;
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-bg px-4 py-2.5">
      <div className="flex items-center gap-2 text-base font-bold tracking-tight">
        <Logo size={40} />
        {branding.name}
      </div>
      {canEdit && (
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => dispatch({ type: "setAddOpen", open: true })}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 font-semibold text-accent-ink disabled:opacity-70"
        >
          <Plus size={16} aria-hidden="true" />
          {t.library.add}
        </button>
        <button type="button" aria-label={t.library.addMany} title={t.common.comingSoon} disabled className={iconButton}>
          <ListPlus size={18} />
        </button>
        <button type="button" aria-label={t.common.edit} title={t.common.comingSoon} disabled className={iconButton}>
          <Pencil size={18} />
        </button>
        <button
          type="button"
          aria-label={loaned ? t.loans.markReturned : t.loans.lend}
          title={loaned ? t.loans.markReturned : t.loans.lend}
          disabled={!selected}
          onClick={() =>
            selected && (loaned ? dispatch({ type: "returnBook", bookId: selected.id }) : onLend())
          }
          className={iconButton}
        >
          {loaned ? <Undo2 size={18} /> : <HandHelping size={18} />}
        </button>
      </div>
      )}
      <ViewSwitcher />
      <button
        type="button"
        aria-label={state.detailsOpen ? t.library.hideDetails : t.library.showDetails}
        aria-pressed={state.detailsOpen}
        onClick={() => dispatch({ type: "toggleDetails" })}
        className={`flex size-9 items-center justify-center rounded-lg ${
          state.detailsOpen ? "bg-selected text-accent" : "text-ink-soft hover:bg-chip"
        }`}
      >
        <PanelRight size={18} />
      </button>
      <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-3">
        <SearchBox className="max-w-90 min-w-52 flex-1" />
        <LayoutPicker />
        <AccountMenu />
      </div>
    </header>
  );
}
