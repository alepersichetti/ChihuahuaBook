"use client";

import { mapPediaRecords, type PediaBook, type PediaRecordError } from "@/server/core/books/pedia";
import { AlertTriangle, CheckCircle2, FileArchive, FolderOpen, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { PruneReport } from "@/server/core/books/import";
import { filesFromDrop, filesFromInput, isLooseXml, readBundle, type Bundle, type BundleFile } from "../../import/bundle";
import { matchCovers, type CoverMatch } from "../../import/covers";
import { countReplaced, saveImport, type ImportMode, type SaveOutcome, type SaveProgress } from "../../import/save";
import { toLibraryBook } from "../../import/to-library";
import { parsePediaXml } from "../../import/xml";
import { useT } from "../../i18n/i18n-context";
import type { Messages } from "../../i18n/messages";
import { useLibrary } from "./library-context";

type Preview = {
  readonly bundle: Bundle;
  readonly format: "plist" | "xml";
  readonly books: readonly PediaBook[];
  readonly errors: readonly PediaRecordError[];
  readonly covers: CoverMatch;
};

type Stage =
  | { readonly kind: "pick"; readonly problem: string | null }
  | { readonly kind: "reading" }
  | { readonly kind: "preview"; readonly preview: Preview }
  | { readonly kind: "saving"; readonly preview: Preview; readonly progress: SaveProgress | null }
  | { readonly kind: "done"; readonly preview: Preview; readonly outcome: SaveOutcome };

const pick: Stage = { kind: "pick", problem: null };

/** Dal bundle all'anteprima: niente viene ancora salvato. */
const buildPreview = async (files: readonly BundleFile[], t: Messages): Promise<Preview | string> => {
  if (isLooseXml(files)) return t.importer.xmlAlone;
  const bundle = await readBundle(files);
  if (!bundle.xml) return t.importer.noXml;
  const parsed = parsePediaXml(await bundle.xml.blob.text());
  if (parsed.isErr()) return t.importer.unreadable(bundle.xml.path, parsed.error);
  if (parsed.value.records.length === 0) return t.importer.noRecords(bundle.xml.path);
  const { books, errors } = mapPediaRecords(parsed.value.records);
  return { bundle, format: parsed.value.format, books, errors, covers: matchCovers(books, bundle.images) };
};

// Il bundle si chiama spesso "Libreria", come la collezione principale: il prefisso evita confusione.
const collectionName = (preview: Preview) => `Bookpedia: ${preview.bundle.name}`;

function Notice({ tone, children }: { tone: "ok" | "warn"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <p className={`flex gap-2 text-sm ${tone === "ok" ? "text-ink" : "text-[#b54708]"}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function Problems({ summary, items }: { summary: string; items: readonly { title: string | null; message: string }[] }) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <details className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
      <summary className="cursor-pointer text-ink-soft">{summary}</summary>
      <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-auto text-xs text-muted">
        {items.map((item, index) => (
          <li key={index}>
            <span className="font-semibold text-ink">{item.title ?? t.importer.untitled}</span>: {item.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PreviewSummary({ preview }: { preview: Preview }) {
  const { books, errors, covers, bundle } = preview;
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <Notice tone="ok">
        {t.importer.ready(books.length, bundle.name)}
      </Notice>
      {covers.method === "none" ? (
        bundle.images.length > 0 && (
          <Notice tone="warn">
            {t.importer.unmatchedImages(bundle.images.length)}
          </Notice>
        )
      ) : (
        <Notice tone={covers.method === "name" ? "ok" : "warn"}>
          {covers.method === "position"
            ? t.importer.coversByPosition(covers.bySourceId.size)
            : t.importer.coversMatched(covers.bySourceId.size)}
        </Notice>
      )}
      <Problems
        summary={t.importer.discarded(errors.length)}
        items={errors.map((error) => ({
          title: error.title ?? t.importer.record(error.index + 1),
          message: error.issues.map((issue) => `${issue.path || t.importer.recordField}: ${issue.message}`).join("; "),
        }))}
      />
    </div>
  );
}

function ProgressBar({ progress }: { progress: SaveProgress | null }) {
  const t = useT();
  const ratio = progress && progress.total > 0 ? progress.done / progress.total : 0;
  const label = !progress
    ? t.importer.preparing
    : progress.phase === "books"
      ? t.importer.savingBooks(progress.done, progress.total)
      : progress.phase === "prune"
        ? t.importer.removingBooks
        : t.importer.uploadingCovers(progress.done, progress.total);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-ink-soft">{label}</div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        className="h-2 overflow-hidden rounded-full bg-chip"
      >
        <div className="h-full bg-accent transition-[width]" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function OutcomeSummary({ preview, outcome }: { preview: Preview; outcome: SaveOutcome }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <Notice tone="ok">
        {t.importer.added(preview.books.length, collectionName(preview))}
      </Notice>
      {outcome.kind === "unavailable" ? (
        <Notice tone="warn">
          {t.importer.notSaved(
            outcome.reason === "unauthenticated"
              ? t.importer.needSignIn
              : outcome.reason === "misconfigured"
                ? t.importer.misconfigured
                : outcome.message,
          )}
        </Notice>
      ) : (
        <>
          <Notice tone="ok">
            {t.importer.serverOutcome(outcome.created, outcome.updated, outcome.unchanged, outcome.coversUploaded)}
          </Notice>
          {outcome.removed !== null && <Notice tone="ok">{t.importer.removedOutcome(outcome.removed)}</Notice>}
          {outcome.removeProblem && <Notice tone="warn">{t.importer.removeFailed(outcome.removeProblem)}</Notice>}
          <Problems summary={t.importer.booksNotSaved(outcome.problems.length)} items={outcome.problems} />
          <Problems
            summary={t.importer.coversNotUploaded(outcome.coverProblems.length)}
            items={outcome.coverProblems}
          />
        </>
      )}
    </div>
  );
}

// Stato del conteggio dei libri che la sostituzione eliminerebbe.
type ReplaceCount =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly report: PruneReport }
  | { readonly kind: "unknown" };

function ModeChoice({
  mode,
  onMode,
  count,
  confirmed,
  onConfirm,
}: {
  mode: ImportMode;
  onMode: (mode: ImportMode) => void;
  count: ReplaceCount | null;
  confirmed: boolean;
  onConfirm: (confirmed: boolean) => void;
}) {
  const t = useT();
  const option = (value: ImportMode, label: string, hint: string) => (
    <label
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        mode === value ? "border-accent bg-selected" : "border-line-strong"
      }`}
    >
      <input type="radio" name="import-mode" checked={mode === value} onChange={() => onMode(value)} className="mt-0.5" />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{t.importer.modeLegend}</legend>
      {option("delta", t.importer.modeDelta, t.importer.modeDeltaHint)}
      {option("replace", t.importer.modeReplace, t.importer.modeReplaceHint)}
      {mode === "replace" && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#b42318]/40 bg-[#b42318]/5 px-3 py-2 text-sm">
          {count?.kind === "loading" ? (
            <p className="flex items-center gap-2 text-ink-soft">
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              {t.importer.replaceCounting}
            </p>
          ) : count?.kind === "ready" ? (
            <Notice tone="warn">{t.importer.replaceWillDelete(count.report.removed, count.report.kept)}</Notice>
          ) : (
            <Notice tone="warn">{t.importer.replaceUnknown}</Notice>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} className="mt-0.5" />
            <span>{t.importer.replaceConfirm}</span>
          </label>
        </div>
      )}
    </fieldset>
  );
}

export function ImportDialog() {
  const { state, dispatch } = useLibrary();
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>(pick);
  const [mode, setMode] = useState<ImportMode>("delta");
  const [confirmed, setConfirmed] = useState(false);
  const [replaceCount, setReplaceCount] = useState<ReplaceCount | null>(null);
  const previewing = stage.kind === "preview" ? stage.preview : null;
  const [dragging, setDragging] = useState(false);
  const busy = stage.kind === "reading" || stage.kind === "saving";

  useEffect(() => {
    if (state.importOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [state.importOpen]);

  // React non conosce l'attributo per scegliere cartelle: va messo a mano.
  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, [stage.kind]);

  // Ogni conteggio ha un numero: arriva tardi una risposta vecchia, la si ignora.
  const countRequest = useRef(0);

  const chooseMode = (next: ImportMode) => {
    setMode(next);
    setConfirmed(false);
    if (next !== "replace" || !previewing) return;
    // Scegliendo la sostituzione, il server conta subito quanti libri spariranno.
    const request = ++countRequest.current;
    setReplaceCount({ kind: "loading" });
    countReplaced(previewing.books).then((report) => {
      if (request === countRequest.current) setReplaceCount(report ? { kind: "ready", report } : { kind: "unknown" });
    });
  };

  const backToPick = () => {
    countRequest.current += 1;
    setStage(pick);
    setMode("delta");
    setConfirmed(false);
    setReplaceCount(null);
  };

  const close = () => {
    if (busy) return;
    dispatch({ type: "setImportOpen", open: false });
    backToPick();
  };

  const load = (files: Promise<readonly BundleFile[]>) => {
    setStage({ kind: "reading" });
    files
      .then((list) => buildPreview(list, t))
      .then((result) =>
        setStage(typeof result === "string" ? { kind: "pick", problem: result } : { kind: "preview", preview: result }),
      )
      .catch((cause: unknown) =>
        setStage({ kind: "pick", problem: t.importer.readFailed(cause instanceof Error ? cause.message : String(cause)) }),
      );
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    load(filesFromDrop(event.dataTransfer.items));
  };

  const start = (preview: Preview) => {
    const addedAt = new Date().toISOString();
    // Subito nella libreria, con le copertine lette dal disco.
    dispatch({
      type: "importBooks",
      collectionName: collectionName(preview),
      replace: mode === "replace",
      books: preview.books.map((book) => {
        const cover = preview.covers.bySourceId.get(book.sourceId);
        return toLibraryBook(book, cover ? URL.createObjectURL(cover.blob) : null, addedAt);
      }),
    });
    setStage({ kind: "saving", preview, progress: null });
    saveImport({
      books: preview.books,
      covers: preview.covers.bySourceId,
      mode,
      onProgress: (progress) => setStage({ kind: "saving", preview, progress }),
    })
      .catch((cause: unknown): SaveOutcome => ({
        kind: "unavailable",
        reason: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      }))
      .then((outcome) => setStage({ kind: "done", preview, outcome }));
  };

  const button = "flex h-10 items-center justify-center gap-2 rounded-lg px-4";

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="import-title"
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl border border-line bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 id="import-title" className="flex items-center gap-2 text-lg font-semibold">
            <Upload size={20} className="text-accent" aria-hidden="true" />
            {t.importer.title}
          </h2>
          <button type="button" aria-label={t.common.close} onClick={close} disabled={busy} className="rounded-lg p-1.5 text-muted hover:bg-chip disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        {stage.kind === "pick" && (
          <>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={drop}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm ${
                dragging ? "border-accent bg-selected" : "border-line-strong"
              }`}
            >
              <p className="text-ink-soft">
                {t.importer.dropBefore}
                <strong>.pedia</strong>
                {t.importer.dropAfter}
                <br />
                {t.importer.dropZip}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <label className={`${button} cursor-pointer border border-line-strong bg-surface hover:bg-chip`}>
                  <FolderOpen size={16} aria-hidden="true" />
                  {t.importer.chooseFolder}
                  <input
                    ref={folderInput}
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(event) => event.target.files && load(Promise.resolve(filesFromInput([...event.target.files])))}
                  />
                </label>
                <label className={`${button} cursor-pointer border border-line-strong bg-surface hover:bg-chip`}>
                  <FileArchive size={16} aria-hidden="true" />
                  {t.importer.chooseFile}
                  <input
                    type="file"
                    accept=".pedia,.zip,application/zip"
                    className="sr-only"
                    onChange={(event) => event.target.files && load(Promise.resolve(filesFromInput([...event.target.files])))}
                  />
                </label>
              </div>
            </div>
            <p className="text-xs text-muted">
              {t.importer.macHint}
            </p>
            {stage.problem && <Notice tone="warn">{stage.problem}</Notice>}
          </>
        )}

        {stage.kind === "reading" && (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            {t.importer.reading}
          </p>
        )}

        {stage.kind === "preview" && (
          <>
            <PreviewSummary preview={stage.preview} />
            <ModeChoice
              mode={mode}
              onMode={chooseMode}
              count={replaceCount}
              confirmed={confirmed}
              onConfirm={setConfirmed}
            />
          </>
        )}

        {stage.kind === "saving" && <ProgressBar progress={stage.progress} />}

        {stage.kind === "done" && <OutcomeSummary preview={stage.preview} outcome={stage.outcome} />}

        <div className="flex justify-end gap-2 pt-1">
          {stage.kind === "preview" && (
            <>
              <button type="button" onClick={backToPick} className={`${button} border border-line-strong`}>
                {t.common.back}
              </button>
              {mode === "replace" ? (
                <button
                  type="button"
                  disabled={stage.preview.books.length === 0 || !confirmed || replaceCount?.kind !== "ready"}
                  onClick={() => start(stage.preview)}
                  className={`${button} bg-[#b42318] font-semibold text-white disabled:opacity-50`}
                >
                  {t.importer.replaceBooks(stage.preview.books.length)}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={stage.preview.books.length === 0}
                  onClick={() => start(stage.preview)}
                  className={`${button} bg-accent font-semibold text-accent-ink disabled:opacity-50`}
                >
                  {t.importer.importBooks(stage.preview.books.length)}
                </button>
              )}
            </>
          )}
          {stage.kind === "done" && (
            <>
              <button type="button" onClick={backToPick} className={`${button} border border-line-strong`}>
                {t.importer.another}
              </button>
              <button type="button" onClick={close} className={`${button} bg-accent font-semibold text-accent-ink`}>
                {t.common.done}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
