"use client";

import { ChartColumn, ChevronDown, ChevronRight, Plus, Settings, Upload } from "lucide-react";
import { useT } from "../../i18n/i18n-context";
import { useSettings } from "../../settings/settings-context";
import { collectionName } from "../labels";
import type { Collection } from "../model";
import { childrenOf } from "../query";
import { collectionIcon } from "./icons";
import { useLibrary } from "./library-context";

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

const specialKinds = new Set<Collection["kind"]>(["library", "loaned", "wishlist"]);

function CollectionLink({ collection, depth }: { collection: Collection; depth: number }) {
  const { state, dispatch, counts } = useLibrary();
  const t = useT();
  const name = collectionName(collection, t);
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
          aria-current={active ? "page" : undefined}
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

// Colonna delle collezioni.
export function Sidebar({ className = "w-58 border-r" }: { className?: string }) {
  const { state, dispatch, canEdit } = useLibrary();
  const t = useT();
  const roots = childrenOf(state.library.collections, null);
  const special = roots.filter((collection) => specialKinds.has(collection.kind));
  const own = roots.filter((collection) => !specialKinds.has(collection.kind));
  return (
    <nav aria-label={t.collections.title} className={`flex shrink-0 flex-col gap-1 border-line bg-panel px-2.5 py-3.5 text-sm ${className}`}>
      <ul className="flex flex-col gap-0.5">
        {special.map((collection) => (
          <CollectionLink key={collection.id} collection={collection} depth={0} />
        ))}
      </ul>
      <div className="flex items-center justify-between px-2.5 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        {t.collections.title}
        {canEdit && (
          <button type="button" aria-label={t.collections.new} title={t.common.comingSoon} disabled className="rounded p-1 disabled:opacity-60">
            <Plus size={14} />
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-0.5">
        {own.map((collection) => (
          <CollectionLink key={collection.id} collection={collection} depth={0} />
        ))}
      </ul>
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
  );
}
