"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n/i18n-context";
import { foldersWithPath } from "../query";
import { useLibrary } from "./library-context";

export const newCollectionId = () => `collection:${crypto.randomUUID()}`;

export type NewCollection = {
  readonly name: string;
  readonly kind: "regular" | "folder";
  readonly parentId: string | null;
};

const small = "h-7 w-full min-w-0 rounded-md border border-line-strong bg-surface px-1.5 text-xs normal-case tracking-normal text-ink";

/**
 * Campo per creare una collezione o una cartella, anche dentro una cartella esistente.
 * Invio crea, Esc annulla. `withKind` mostra la scelta tra collezione e cartella.
 */
export function NewCollectionInput({
  onCreate,
  onCancel,
  withKind = false,
  className = "",
}: {
  onCreate: (collection: NewCollection) => void;
  onCancel: () => void;
  withKind?: boolean;
  className?: string;
}) {
  const t = useT();
  const { state } = useLibrary();
  const folders = foldersWithPath(state.library.collections);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<NewCollection["kind"]>("regular");
  const [parentId, setParentId] = useState("");
  const create = () => name.trim() && onCreate({ name: name.trim(), kind, parentId: parentId || null });
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={name}
          aria-label={t.addBook.newCollectionName}
          placeholder={t.addBook.newCollectionName}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              create();
            } else if (event.key === "Escape") {
              // Esc chiude solo il campo, non la finestra che lo contiene.
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm normal-case tracking-normal text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          aria-label={t.addBook.create}
          disabled={!name.trim()}
          onClick={create}
          className="rounded-md p-1.5 text-accent hover:bg-chip disabled:opacity-40"
        >
          <Check size={16} />
        </button>
        <button type="button" aria-label={t.common.cancel} onClick={onCancel} className="rounded-md p-1.5 text-muted hover:bg-chip">
          <X size={16} />
        </button>
      </div>
      {(withKind || folders.length > 0) && (
        <div className="flex flex-col gap-1 pr-[60px]">
          {withKind && (
            <select
              aria-label={t.collections.kindLabel}
              value={kind}
              onChange={(event) => setKind(event.target.value as NewCollection["kind"])}
              className={small}
            >
              <option value="regular">{t.collections.kindCollection}</option>
              <option value="folder">{t.collections.kindFolder}</option>
            </select>
          )}
          {folders.length > 0 && (
            <select
              aria-label={t.collections.parentLabel}
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className={small}
            >
              <option value="">{t.collections.noFolder}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
