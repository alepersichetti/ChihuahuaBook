"use client";

import { Settings } from "lucide-react";
import { useSettings } from "../../settings/settings-context";
import { collectionIcon } from "./icons";
import { useLibrary } from "./library-context";
import { Logo } from "./logo";

// Barra laterale a sole icone del layout galleria.
export function IconRail() {
  const { state, dispatch, counts } = useLibrary();
  const { canOpen, openPanel } = useSettings();
  const collections = state.library.collections.filter((collection) => collection.kind !== "folder");
  return (
    <nav aria-label="Collezioni" className="flex w-17 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-panel py-3.5">
      <Logo size={40} className="mb-2.5" />
      {collections.map((collection) => {
        const { Icon } = collectionIcon(collection);
        const active = collection.id === state.collectionId;
        const label = `${collection.name}, ${counts[collection.id]} libri`;
        return (
          <button
            key={collection.id}
            type="button"
            aria-label={label}
            title={label}
            aria-current={active ? "page" : undefined}
            onClick={() => dispatch({ type: "selectCollection", collectionId: collection.id })}
            className={`flex size-11 items-center justify-center rounded-xl ${
              active ? "bg-ink text-bg" : "text-ink-soft hover:bg-chip"
            }`}
          >
            <Icon size={20} aria-hidden="true" />
          </button>
        );
      })}
      {canOpen && (
        <button
          type="button"
          aria-label="Impostazioni"
          title="Impostazioni"
          onClick={openPanel}
          className="mt-auto flex size-11 items-center justify-center rounded-xl text-ink-soft hover:bg-chip"
        >
          <Settings size={20} />
        </button>
      )}
    </nav>
  );
}
