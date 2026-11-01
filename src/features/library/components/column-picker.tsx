"use client";

import { Check, Columns3, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useT } from "../../i18n/i18n-context";
import { customColumnId, newCustomColumn, renamedLabel, type NewColumnProblem } from "../columns";
import { removeColumn, renameColumn, saveColumns } from "../columns-api";
import { columnKeys, customColumnKinds, type ColumnId, type CustomColumn, type CustomColumnKind } from "../model";
import { useLibrary } from "./library-context";

const row = "flex items-center gap-2 rounded px-1.5 py-1 hover:bg-chip touch:py-2";
const heading = "px-1.5 pt-1 text-[11px] font-semibold tracking-wide text-muted uppercase";

function ColumnToggle({ column, label }: { column: ColumnId; label: string }) {
  const { columns, dispatch } = useLibrary();
  return (
    <label className={`${row} min-w-0 flex-1`}>
      <input
        type="checkbox"
        checked={columns.includes(column)}
        disabled={column === "title"}
        onChange={() => dispatch({ type: "toggleColumn", column })}
        className="accent-(--accent)"
      />
      <span className="truncate">{label}</span>
    </label>
  );
}

// Nuova colonna: nome e tipo. Invio crea, Esc annulla.
function NewColumnForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useLibrary();
  const t = useT();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CustomColumnKind>("text");
  const [problem, setProblem] = useState<NewColumnProblem | null>(null);
  const create = () => {
    const result = newCustomColumn(name, kind, state.library.customColumns, t);
    if (!result.ok) return setProblem(result.problem);
    dispatch({ type: "createColumn", column: result.column });
    void saveColumns([result.column]);
    onDone();
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-panel p-2">
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        {t.library.customColumns.name}
        <input
          autoFocus
          value={name}
          placeholder={t.library.customColumns.namePlaceholder}
          aria-invalid={problem !== null}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              create();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onDone();
            }
          }}
          className="h-8 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-accent aria-invalid:border-danger"
        />
      </label>
      {problem && (
        <p role="alert" className="text-xs text-danger">
          {t.library.customColumns[problem]}
        </p>
      )}
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        {t.library.customColumns.kind}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as CustomColumnKind)}
          className="h-8 rounded-md border border-line-strong bg-surface px-1.5 text-sm text-ink"
        >
          {customColumnKinds.map((item) => (
            <option key={item} value={item}>
              {t.library.customColumns.kinds[item]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-1.5 pt-0.5">
        <button type="button" onClick={onDone} className="h-8 rounded-md px-2.5 text-sm text-ink-soft hover:bg-chip">
          {t.library.customColumns.cancel}
        </button>
        <button
          type="button"
          onClick={create}
          disabled={name.trim() === ""}
          className="h-8 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {t.library.customColumns.create}
        </button>
      </div>
    </div>
  );
}

// Nuovo nome al posto della riga: Invio salva, Esc annulla. La chiave (e quindi i valori) non cambia.
function RenameField({ column, onDone }: { column: CustomColumn; onDone: () => void }) {
  const { state, dispatch } = useLibrary();
  const t = useT();
  const [name, setName] = useState(column.label);
  const [problem, setProblem] = useState<NewColumnProblem | null>(null);
  const save = () => {
    const result = renamedLabel(column.key, name, state.library.customColumns, t);
    if (!result.ok) return setProblem(result.problem);
    if (result.label !== column.label) {
      dispatch({ type: "renameColumn", key: column.key, label: result.label });
      void renameColumn(column.key, result.label);
    }
    onDone();
  };
  const iconButton = "flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-chip touch:size-9";
  return (
    <div className="flex flex-col gap-1 px-1.5 py-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          size={1}
          value={name}
          aria-label={t.library.customColumns.newName(column.label)}
          aria-invalid={problem !== null}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onDone();
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-accent aria-invalid:border-danger touch:h-9"
        />
        <button type="button" aria-label={t.library.customColumns.save} onClick={save} className={`${iconButton} text-accent`}>
          <Check size={15} aria-hidden="true" />
        </button>
        <button type="button" aria-label={t.library.customColumns.cancel} onClick={onDone} className={`${iconButton} text-muted`}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-xs text-danger">
          {t.library.customColumns[problem]}
        </p>
      )}
    </div>
  );
}

/**
 * Menu Colonne: quali mostrare nella tabella. Bibliotecari e amministratori
 * possono anche creare colonne nuove, rinominarle ed eliminarle, per tutta la biblioteca.
 */
export function ColumnPicker() {
  const { state, dispatch, canEdit } = useLibrary();
  const t = useT();
  const [adding, setAdding] = useState(false);
  // Eliminare chiede un secondo clic sullo stesso pulsante.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const custom = state.library.customColumns;
  const remove = (key: string) => {
    if (confirming !== key) return setConfirming(key);
    dispatch({ type: "deleteColumn", key });
    void removeColumn(key);
    setConfirming(null);
  };
  return (
    <details className="relative" onToggle={() => (setAdding(false), setConfirming(null), setRenaming(null))}>
      <summary className="flex h-8 touch:h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink-soft">
        <Columns3 size={15} aria-hidden="true" />
        {t.library.columns}
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex max-h-[min(70vh,560px)] w-64 flex-col gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 text-sm shadow-lg">
        <fieldset className="flex flex-col gap-0.5">
          <legend className={heading}>{custom.length > 0 ? t.library.customColumns.fixed : t.library.visibleColumns}</legend>
          {columnKeys.map((column) => (
            <ColumnToggle key={column} column={column} label={t.columns[column]} />
          ))}
        </fieldset>
        {custom.length > 0 && (
          <fieldset className="flex flex-col gap-0.5 border-t border-line pt-1">
            <legend className={`${heading} pt-2`}>{t.library.customColumns.custom}</legend>
            {custom.map((column) =>
              renaming === column.key ? (
                <RenameField key={column.key} column={column} onDone={() => setRenaming(null)} />
              ) : (
              <div key={column.key} className="flex items-center gap-0.5">
                <ColumnToggle column={customColumnId(column.key)} label={column.label} />
                {canEdit && confirming !== column.key && (
                  <button
                    type="button"
                    aria-label={t.library.customColumns.rename(column.label)}
                    title={t.library.customColumns.rename(column.label)}
                    onClick={() => (setRenaming(column.key), setConfirming(null))}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-chip hover:text-ink touch:size-9"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                )}
                {canEdit &&
                  (confirming === column.key ? (
                    <button
                      type="button"
                      onClick={() => remove(column.key)}
                      title={t.library.customColumns.removeHint}
                      className="h-7 shrink-0 rounded-md border border-danger bg-danger-soft px-2 text-xs font-semibold text-danger"
                    >
                      {t.library.customColumns.confirmRemove}
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={t.library.customColumns.remove(column.label)}
                      title={t.library.customColumns.remove(column.label)}
                      onClick={() => remove(column.key)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-chip hover:text-danger touch:size-9"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  ))}
              </div>
              ),
            )}
          </fieldset>
        )}
        {canEdit &&
          (adding ? (
            <NewColumnForm onDone={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-1 flex h-8 items-center gap-1.5 rounded-md border-t border-line px-1.5 pt-1 text-left font-medium text-accent hover:bg-chip touch:h-10"
            >
              <Plus size={15} aria-hidden="true" />
              {t.library.customColumns.add}
            </button>
          ))}
      </div>
    </details>
  );
}
