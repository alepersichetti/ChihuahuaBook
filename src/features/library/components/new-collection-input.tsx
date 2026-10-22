"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n/i18n-context";

export const newCollectionId = () => `collection:${crypto.randomUUID()}`;

/** Campo per dare il nome a una nuova collezione: Invio crea, Esc annulla. */
export function NewCollectionInput({
  onCreate,
  onCancel,
  className = "",
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const create = () => name.trim() && onCreate(name.trim());
  return (
    <div className={`flex items-center gap-1 ${className}`}>
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
  );
}
