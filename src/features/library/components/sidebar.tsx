"use client";

import { ChartColumn, ChevronDown, ChevronRight, Plus, Upload } from "lucide-react";
import type { Collection } from "../model";
import { childrenOf } from "../query";
import { collectionIcon } from "./icons";
import { useLibrary } from "./library-context";

const specialKinds = new Set<Collection["kind"]>(["library", "loaned", "wishlist"]);

function CollectionLink({ collection, depth }: { collection: Collection; depth: number }) {
  const { state, dispatch, counts } = useLibrary();
  const { Icon, tone } = collectionIcon(collection);
  const active = state.collectionId === collection.id;
  const isFolder = collection.kind === "folder";
  const collapsed = state.collapsedFolders.includes(collection.id);
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <li>
      <div
        className={`flex items-center rounded-lg ${active ? "bg-selected font-semibold" : "hover:bg-chip"}`}
        style={{ paddingLeft: depth * 16 }}
      >
        {isFolder && (
          <button
            type="button"
            aria-label={collapsed ? `Apri ${collection.name}` : `Chiudi ${collection.name}`}
            aria-expanded={!collapsed}
            onClick={() => dispatch({ type: "toggleFolder", folderId: collection.id })}
            className="ml-1 rounded p-1 text-muted"
          >
            <Chevron size={14} />
          </button>
        )}
        <button
          type="button"
          aria-current={active ? "page" : undefined}
          onClick={() => dispatch({ type: "selectCollection", collectionId: collection.id })}
          className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left ${isFolder ? "pr-2.5" : "px-2.5"}`}
        >
          <Icon size={16} className={`shrink-0 ${tone}`} aria-hidden="true" />
          <span className="flex-1 truncate">{collection.name}</span>
          {collection.kind === "regular" && collection.excluded ? (
            <span className="rounded border border-line-strong px-1 text-[11px] font-normal text-muted">
              esclusa
            </span>
          ) : (
            <span className="text-xs font-normal text-muted">{counts[collection.id]}</span>
          )}
        </button>
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

// Colonna delle collezioni dei layout classico e scaffale.
export function Sidebar({ className = "w-58 border-r" }: { className?: string }) {
  const { state } = useLibrary();
  const roots = childrenOf(state.library.collections, null);
  const special = roots.filter((collection) => specialKinds.has(collection.kind));
  const own = roots.filter((collection) => !specialKinds.has(collection.kind));
  return (
    <nav aria-label="Collezioni" className={`flex shrink-0 flex-col gap-1 border-line bg-panel px-2.5 py-3.5 text-sm ${className}`}>
      <ul className="flex flex-col gap-0.5">
        {special.map((collection) => (
          <CollectionLink key={collection.id} collection={collection} depth={0} />
        ))}
      </ul>
      <div className="flex items-center justify-between px-2.5 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        Collezioni
        <button type="button" aria-label="Nuova collezione" title="In arrivo" disabled className="rounded p-1 disabled:opacity-60">
          <Plus size={14} />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {own.map((collection) => (
          <CollectionLink key={collection.id} collection={collection} depth={0} />
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3 text-ink-soft">
        <button type="button" disabled title="In arrivo" className="flex items-center gap-2.5 px-2.5 py-1.5 disabled:opacity-60">
          <Upload size={16} aria-hidden="true" />
          Importa .pedia
        </button>
        <button type="button" disabled title="In arrivo" className="flex items-center gap-2.5 px-2.5 py-1.5 disabled:opacity-60">
          <ChartColumn size={16} aria-hidden="true" />
          Statistiche
        </button>
      </div>
    </nav>
  );
}
