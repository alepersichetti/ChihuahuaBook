"use client";

import {
  ArrowDown,
  ArrowUp,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Folder,
  FolderOutput,
  Plus,
  Settings,
  Upload,
} from "lucide-react";
import { createContext, use, useEffect, useRef, useState, type DragEvent } from "react";
import { useT } from "../../i18n/i18n-context";
import { useSettings } from "../../settings/settings-context";
import { collectionName } from "../labels";
import type { Collection } from "../model";
import { canMoveInto, childrenOf, isSystemCollection, moveDestinations, siblingsOf, stepPosition } from "../query";
import { bookMime, carries, collectionMime, placementAt, type DropPlacement } from "./drag";
import { collectionIcon } from "./icons";
import { useLibrary } from "./library-context";
import { NewCollectionInput, newCollectionId } from "./new-collection-input";

// I lettori non vedono le impostazioni.
function SettingsLink() {
  const { canOpen, openPanel } = useSettings();
  const t = useT();
  if (!canOpen) return null;
  return (
    <button
      type="button"
      onClick={openPanel}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-chip"
    >
      <Settings size={16} aria-hidden="true" />
      {t.settings.title}
    </button>
  );
}

type DropTarget = { readonly id: string; readonly placement: DropPlacement };

// Stato del trascinamento condiviso dalle righe della barra laterale.
type SidebarDrag = {
  readonly dragged: string | null;
  readonly setDragged: (id: string | null) => void;
  readonly target: DropTarget | null;
  readonly setTarget: (target: DropTarget | null) => void;
  readonly announce: (message: string, flashId?: string) => void;
  readonly flash: string | null;
};

const SidebarDragContext = createContext<SidebarDrag | null>(null);

const useSidebarDrag = () => {
  const value = use(SidebarDragContext);
  if (!value) throw new Error("useSidebarDrag va usato dentro Sidebar");
  return value;
};

const focusCollection = (id: string) =>
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-collection="${CSS.escape(id)}"]`)?.focus());

/** Sposta una collezione e lo dice a voce: serve a chi usa la tastiera o un lettore di schermo. */
const useMoveCollection = () => {
  const { state, dispatch } = useLibrary();
  const { announce } = useSidebarDrag();
  const t = useT();
  return (id: string, parentId: string | null, beforeId: string | null) => {
    const { collections } = state.library;
    const item = collections.find((collection) => collection.id === id);
    if (!item || !canMoveInto(collections, id, parentId)) return;
    dispatch({ type: "moveCollection", collectionId: id, parentId, beforeId });
    const parent = collections.find((collection) => collection.id === parentId);
    announce(t.collections.moved(collectionName(item, t), parent ? collectionName(parent, t) : t.collections.outsideFolders), id);
    focusCollection(id);
  };
};

// Su desktop compare passando sopra la riga o portandoci il fuoco; sul telefono resta visibile.
const revealOnRow = "md:hidden md:group-focus-within/row:block md:group-hover/row:block";

// Menu "⋯" di ogni collezione: l'alternativa da tastiera (e da telefono) al trascinamento.
function CollectionActions({ collection }: { collection: Collection }) {
  const { state } = useLibrary();
  const t = useT();
  const move = useMoveCollection();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const { collections } = state.library;
  const name = collectionName(collection, t);
  const up = stepPosition(collections, collection.id, -1);
  const down = stepPosition(collections, collection.id, 1);
  const folders = moveDestinations(collections, collection.id).filter((folder) => folder.id !== collection.parentId);
  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };
  const choose = (parentId: string | null, beforeId: string | null) => {
    setOpen(false);
    move(collection.id, parentId, beforeId);
  };
  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-chip disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        aria-label={t.collections.actions(name)}
        aria-expanded={open}
        title={t.collections.actions(name)}
        onClick={() => setOpen(!open)}
        className={`mr-1 rounded p-1 text-muted hover:bg-line ${open ? "" : revealOnRow}`}
      >
        <Ellipsis size={14} />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 flex w-52 flex-col gap-0.5 rounded-lg border border-line bg-surface p-1.5 text-[13px] font-normal shadow-lg">
          <button type="button" autoFocus={up !== null} disabled={!up} onClick={() => up && choose(up.parentId, up.beforeId)} className={item}>
            <ArrowUp size={14} aria-hidden="true" />
            {t.collections.moveUp}
          </button>
          <button type="button" autoFocus={up === null} disabled={!down} onClick={() => down && choose(down.parentId, down.beforeId)} className={item}>
            <ArrowDown size={14} aria-hidden="true" />
            {t.collections.moveDown}
          </button>
          {(collection.parentId !== null || folders.length > 0) && (
            <p className="mt-1 border-t border-line px-2 pt-2 pb-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
              {t.collections.moveTo}
            </p>
          )}
          {collection.parentId !== null && (
            <button type="button" onClick={() => choose(null, null)} className={item}>
              <FolderOutput size={14} aria-hidden="true" />
              {t.collections.outsideFolders}
            </button>
          )}
          {folders.map((folder) => (
            <button key={folder.id} type="button" onClick={() => choose(folder.id, null)} className={item}>
              <Folder size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="truncate">{folder.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Linea che mostra dove finirà la collezione rilasciata.
function DropLine({ placement }: { placement: "before" | "after" }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-1 z-10 h-[3px] rounded-full bg-accent ${placement === "before" ? "-top-0.5" : "-bottom-0.5"}`}
    />
  );
}

function CollectionLink({ collection, depth }: { collection: Collection; depth: number }) {
  const { state, dispatch, counts, canEdit } = useLibrary();
  const { dragged, setDragged, target, setTarget, announce, flash } = useSidebarDrag();
  const move = useMoveCollection();
  const t = useT();
  const name = collectionName(collection, t);
  const { Icon, tone } = collectionIcon(collection);
  const active = state.collectionId === collection.id;
  const isFolder = collection.kind === "folder";
  const movable = canEdit && !isSystemCollection(collection);
  const collapsed = state.collapsedFolders.includes(collection.id);
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  const { collections } = state.library;
  const here = target?.id === collection.id ? target.placement : null;

  // Cosa succederebbe rilasciando qui: null se il rilascio non è permesso.
  const dropAt = (event: DragEvent<HTMLDivElement>): DropPlacement | null => {
    if (!canEdit) return null;
    if (carries(event, bookMime)) return collection.kind === "regular" ? "inside" : null;
    if (!carries(event, collectionMime) || dragged === null || dragged === collection.id || isSystemCollection(collection)) return null;
    const placement = placementAt(event, isFolder);
    return canMoveInto(collections, dragged, placement === "inside" ? collection.id : collection.parentId) ? placement : null;
  };

  const drop = (event: DragEvent<HTMLDivElement>, placement: DropPlacement) => {
    const bookId = event.dataTransfer.getData(bookMime);
    if (bookId && collection.kind === "regular") {
      const book = state.library.books.find((item) => item.id === bookId);
      if (!book) return;
      const already = collection.bookIds.includes(bookId);
      dispatch({ type: "addToCollection", bookIds: [bookId], collectionId: collection.id });
      announce((already ? t.collections.alreadyIn : t.collections.bookAdded)(book.title, name), collection.id);
      return;
    }
    if (dragged === null) return;
    if (placement === "inside") return move(dragged, collection.id, null);
    if (placement === "before") return move(dragged, collection.parentId, collection.id);
    // "Dopo" vuol dire davanti alla sorella successiva, saltando quella che si sta spostando.
    const siblings = siblingsOf(collections, collection.id).filter((item) => item.id !== dragged);
    const next = siblings[siblings.findIndex((item) => item.id === collection.id) + 1];
    move(dragged, collection.parentId, next?.id ?? null);
  };

  return (
    <li>
      <div
        className={`group/row relative flex items-center rounded-lg transition-colors ${
          here === "inside" || flash === collection.id
            ? "bg-selected ring-2 ring-accent"
            : active
              ? "bg-selected"
              : "hover:bg-chip"
        } ${dragged === collection.id ? "opacity-50" : ""} ${active ? "font-semibold" : ""}`}
        style={{ paddingLeft: depth * 16 }}
        onDragOver={(event) => {
          const placement = dropAt(event);
          if (!placement) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = carries(event, bookMime) ? "copy" : "move";
          if (here !== placement) setTarget({ id: collection.id, placement });
        }}
        onDragLeave={(event) => {
          if (here && !event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
        }}
        onDrop={(event) => {
          const placement = dropAt(event);
          setTarget(null);
          if (!placement) return;
          event.preventDefault();
          drop(event, placement);
        }}
      >
        {(here === "before" || here === "after") && <DropLine placement={here} />}
        {isFolder && (
          <button
            type="button"
            aria-label={collapsed ? t.collections.expand(name) : t.collections.collapse(name)}
            aria-expanded={!collapsed}
            onClick={() => dispatch({ type: "toggleFolder", folderId: collection.id })}
            className="ml-1 rounded p-1 text-muted"
          >
            <Chevron size={14} />
          </button>
        )}
        <button
          type="button"
          data-collection={collection.id}
          aria-current={active ? "page" : undefined}
          title={movable ? t.collections.reorderHint : undefined}
          draggable={movable}
          onDragStart={(event) => {
            event.dataTransfer.setData(collectionMime, collection.id);
            event.dataTransfer.effectAllowed = "move";
            setDragged(collection.id);
          }}
          onDragEnd={() => {
            setDragged(null);
            setTarget(null);
          }}
          onKeyDown={(event) => {
            const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
            if (!movable || !event.altKey || step === 0) return;
            event.preventDefault();
            const position = stepPosition(collections, collection.id, step);
            if (position) move(collection.id, position.parentId, position.beforeId);
          }}
          onClick={() => dispatch({ type: "selectCollection", collectionId: collection.id })}
          className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left ${isFolder ? "pr-2.5" : "px-2.5"}`}
        >
          <Icon size={16} className={`shrink-0 ${tone}`} aria-hidden="true" />
          <span className="flex-1 truncate">{name}</span>
          {collection.kind === "regular" && collection.excluded ? (
            <span className="rounded border border-line-strong px-1 text-[11px] font-normal text-muted">
              {t.collections.excluded}
            </span>
          ) : (
            <span className="text-xs font-normal text-muted">{counts[collection.id]}</span>
          )}
        </button>
        {movable && <CollectionActions collection={collection} />}
      </div>
      {isFolder && !collapsed && <CollectionTree parentId={collection.id} depth={depth + 1} />}
    </li>
  );
}

function CollectionTree({ parentId, depth }: { parentId: string; depth: number }) {
  const { state } = useLibrary();
  return (
    <ul className="flex flex-col gap-0.5">
      {childrenOf(state.library.collections, parentId).map((child) => (
        <CollectionLink key={child.id} collection={child} depth={depth} />
      ))}
    </ul>
  );
}

// Compare solo mentre si trascina una collezione che sta in una cartella.
function OutsideFoldersZone() {
  const { state } = useLibrary();
  const { dragged, setTarget } = useSidebarDrag();
  const move = useMoveCollection();
  const t = useT();
  const [over, setOver] = useState(false);
  const item = state.library.collections.find((collection) => collection.id === dragged);
  if (!item || item.parentId === null) return null;
  return (
    <div
      onDragOver={(event) => {
        if (!carries(event, collectionMime)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setTarget(null);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        move(item.id, null, null);
      }}
      className={`mt-1 flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-2 text-xs ${
        over ? "border-accent bg-selected text-ink" : "border-line-strong text-muted"
      }`}
    >
      <FolderOutput size={14} aria-hidden="true" />
      {t.collections.dropOutside}
    </div>
  );
}

const useSidebarDragValue = (): SidebarDrag & { readonly message: string } => {
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [notice, setNotice] = useState<{ message: string; flash: string | null; at: number } | null>(null);
  // Una collezione spostata in un'altra cartella viene ricreata e non riceve il suo dragend:
  // la fine del trascinamento si ascolta sulla finestra.
  useEffect(() => {
    const reset = () => {
      setDragged(null);
      setTarget(null);
    };
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, []);
  // L'avviso e l'evidenziazione spariscono da soli dopo qualche secondo.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  return {
    dragged,
    setDragged,
    target,
    setTarget,
    announce: (message, flash) => setNotice({ message, flash: flash ?? null, at: Date.now() }),
    flash: notice?.flash ?? null,
    message: notice?.message ?? "",
  };
};

// Colonna delle collezioni.
export function Sidebar({ className = "w-58 border-r" }: { className?: string }) {
  const { state, dispatch, canEdit } = useLibrary();
  const t = useT();
  const [creating, setCreating] = useState(false);
  const { message, ...drag } = useSidebarDragValue();
  const roots = childrenOf(state.library.collections, null);
  const special = roots.filter(isSystemCollection);
  const own = roots.filter((collection) => !isSystemCollection(collection));
  return (
    <SidebarDragContext value={drag}>
      <nav aria-label={t.collections.title} className={`flex shrink-0 flex-col gap-1 border-line bg-panel px-2.5 py-3.5 text-sm ${className}`}>
        <ul className="flex flex-col gap-0.5">
          {special.map((collection) => (
            <CollectionLink key={collection.id} collection={collection} depth={0} />
          ))}
        </ul>
        <div className="flex items-center justify-between px-2.5 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          {t.collections.title}
          {canEdit && (
            <button
              type="button"
              aria-label={t.collections.new}
              title={t.collections.new}
              onClick={() => setCreating(true)}
              className="rounded p-1 hover:bg-chip"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        {creating && (
          <NewCollectionInput
            withKind
            className="px-1.5 pb-1"
            onCancel={() => setCreating(false)}
            onCreate={(collection) => {
              dispatch({ type: "createCollection", id: newCollectionId(), ...collection, select: true });
              setCreating(false);
            }}
          />
        )}
        <ul className="flex flex-col gap-0.5">
          {own.map((collection) => (
            <CollectionLink key={collection.id} collection={collection} depth={0} />
          ))}
        </ul>
        <OutsideFoldersZone />
        <p role="status" className={`px-2.5 pt-2 text-xs text-accent ${message ? "" : "sr-only"}`}>
          {message}
        </p>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3 text-ink-soft">
          {canEdit && (
            <button
              type="button"
              onClick={() => dispatch({ type: "setImportOpen", open: true })}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-chip"
            >
              <Upload size={16} aria-hidden="true" />
              {t.importer.menu}
            </button>
          )}
          <button type="button" disabled title={t.common.comingSoon} className="flex items-center gap-2.5 px-2.5 py-1.5 disabled:opacity-60">
            <ChartColumn size={16} aria-hidden="true" />
            {t.library.statistics}
          </button>
          <SettingsLink />
        </div>
      </nav>
    </SidebarDragContext>
  );
}
