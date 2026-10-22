"use client";

import { mapPediaRecords, type PediaBook, type PediaRecordError } from "@/server/core/books/pedia";
import { AlertTriangle, CheckCircle2, FileArchive, FolderOpen, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { filesFromDrop, filesFromInput, readBundle, type Bundle, type BundleFile } from "../../import/bundle";
import { matchCovers, type CoverMatch } from "../../import/covers";
import { saveImport, type SaveOutcome, type SaveProgress } from "../../import/save";
import { toLibraryBook } from "../../import/to-library";
import { parsePediaXml } from "../../import/xml";
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
const buildPreview = async (files: readonly BundleFile[]): Promise<Preview | string> => {
  const bundle = await readBundle(files);
  if (!bundle.xml) {
    return "Nel file non c'è nessun XML: scegli la cartella .pedia completa o il suo zip.";
  }
  const parsed = parsePediaXml(await bundle.xml.blob.text());
  if (parsed.isErr()) return `Non riesco a leggere ${bundle.xml.path}: ${parsed.error}`;
  if (parsed.value.records.length === 0) return `In ${bundle.xml.path} non ho trovato schede di libri.`;
  const { books, errors } = mapPediaRecords(parsed.value.records);
  return { bundle, format: parsed.value.format, books, errors, covers: matchCovers(books, bundle.images) };
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

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
  if (items.length === 0) return null;
  return (
    <details className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
      <summary className="cursor-pointer text-ink-soft">{summary}</summary>
      <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-auto text-xs text-muted">
        {items.map((item, index) => (
          <li key={index}>
            <span className="font-semibold text-ink">{item.title ?? "Senza titolo"}</span>: {item.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PreviewSummary({ preview }: { preview: Preview }) {
  const { books, errors, covers, bundle } = preview;
  return (
    <div className="flex flex-col gap-2">
      <Notice tone="ok">
        {plural(books.length, "libro pronto", "libri pronti")} da importare da «{bundle.name}».
      </Notice>
      {covers.method === "none" ? (
        bundle.images.length > 0 && (
          <Notice tone="warn">
            Ho trovato {plural(bundle.images.length, "immagine", "immagini")} ma non riesco ad abbinarle ai libri.
          </Notice>
        )
      ) : (
        <Notice tone={covers.method === "name" ? "ok" : "warn"}>
          {plural(covers.bySourceId.size, "copertina abbinata", "copertine abbinate")}
          {covers.method === "position" && " in base alla numerazione dei file: controlla qualche libro dopo l'import"}.
        </Notice>
      )}
      <Problems
        summary={`${plural(errors.length, "scheda scartata", "schede scartate")}`}
        items={errors.map((error) => ({
          title: error.title ?? `Scheda ${error.index + 1}`,
          message: error.issues.map((issue) => `${issue.path || "scheda"}: ${issue.message}`).join("; "),
        }))}
      />
    </div>
  );
}

function ProgressBar({ progress }: { progress: SaveProgress | null }) {
  const ratio = progress && progress.total > 0 ? progress.done / progress.total : 0;
  const label = !progress
    ? "Preparazione…"
    : progress.phase === "books"
      ? `Salvo i libri: ${progress.done} di ${progress.total}`
      : `Carico le copertine: ${progress.done} di ${progress.total}`;
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
  return (
    <div className="flex flex-col gap-2">
      <Notice tone="ok">
        {plural(preview.books.length, "libro aggiunto", "libri aggiunti")} alla collezione «{preview.bundle.name}».
      </Notice>
      {outcome.kind === "unavailable" ? (
        <Notice tone="warn">
          Non salvati sul server: {outcome.message} Per ora li vedi solo in questa scheda del browser.
        </Notice>
      ) : (
        <>
          <Notice tone="ok">
            Sul server: {plural(outcome.created, "nuovo", "nuovi")}, {plural(outcome.updated, "aggiornato", "aggiornati")}
            {outcome.skipped > 0 && `, ${plural(outcome.skipped, "già presente lasciato", "già presenti lasciati")} com'era`}
            ; {plural(outcome.coversUploaded, "copertina caricata", "copertine caricate")}.
          </Notice>
          <Problems summary={plural(outcome.problems.length, "libro non salvato", "libri non salvati")} items={outcome.problems} />
          <Problems
            summary={plural(outcome.coverProblems.length, "copertina non caricata", "copertine non caricate")}
            items={outcome.coverProblems}
          />
        </>
      )}
    </div>
  );
}

export function ImportDialog() {
  const { state, dispatch } = useLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>(pick);
  const [updateExisting, setUpdateExisting] = useState(true);
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

  const close = () => {
    if (busy) return;
    dispatch({ type: "setImportOpen", open: false });
    setStage(pick);
  };

  const load = (files: Promise<readonly BundleFile[]>) => {
    setStage({ kind: "reading" });
    files
      .then(buildPreview)
      .then((result) =>
        setStage(typeof result === "string" ? { kind: "pick", problem: result } : { kind: "preview", preview: result }),
      )
      .catch((cause: unknown) =>
        setStage({ kind: "pick", problem: `Lettura non riuscita: ${cause instanceof Error ? cause.message : String(cause)}` }),
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
      collectionName: preview.bundle.name,
      books: preview.books.map((book) => {
        const cover = preview.covers.bySourceId.get(book.sourceId);
        return toLibraryBook(book, cover ? URL.createObjectURL(cover.blob) : null, addedAt);
      }),
    });
    setStage({ kind: "saving", preview, progress: null });
    saveImport({
      books: preview.books,
      covers: preview.covers.bySourceId,
      onExisting: updateExisting ? "update" : "skip",
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
            Importa da Bookpedia
          </h2>
          <button type="button" aria-label="Chiudi" onClick={close} disabled={busy} className="rounded-lg p-1.5 text-muted hover:bg-chip disabled:opacity-40">
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
                Trascina qui il file <strong>.pedia</strong> esportato da Bookpedia,
                <br />
                oppure lo zip che lo contiene.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <label className={`${button} cursor-pointer border border-line-strong bg-surface hover:bg-chip`}>
                  <FolderOpen size={16} aria-hidden="true" />
                  Scegli la cartella
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
                  Scegli zip o XML
                  <input
                    type="file"
                    accept=".zip,.xml,.plist,application/zip,text/xml"
                    className="sr-only"
                    onChange={(event) => event.target.files && load(Promise.resolve(filesFromInput([...event.target.files])))}
                  />
                </label>
              </div>
            </div>
            <p className="text-xs text-muted">
              Sul Mac un .pedia è un pacchetto: se il selettore non lo apre, trascinalo qui oppure comprimilo
              (tasto destro, «Comprimi») e scegli lo zip. Il file viene letto nel browser.
            </p>
            {stage.problem && <Notice tone="warn">{stage.problem}</Notice>}
          </>
        )}

        {stage.kind === "reading" && (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            Leggo il file…
          </p>
        )}

        {stage.kind === "preview" && (
          <>
            <PreviewSummary preview={stage.preview} />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(event) => setUpdateExisting(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Aggiorna i libri già importati in passato
                <span className="block text-xs text-muted">
                  Se togli la spunta, quelli già presenti restano come sono. In nessun caso si creano doppioni.
                </span>
              </span>
            </label>
          </>
        )}

        {stage.kind === "saving" && <ProgressBar progress={stage.progress} />}

        {stage.kind === "done" && <OutcomeSummary preview={stage.preview} outcome={stage.outcome} />}

        <div className="flex justify-end gap-2 pt-1">
          {stage.kind === "preview" && (
            <>
              <button type="button" onClick={() => setStage(pick)} className={`${button} border border-line-strong`}>
                Indietro
              </button>
              <button
                type="button"
                disabled={stage.preview.books.length === 0}
                onClick={() => start(stage.preview)}
                className={`${button} bg-accent font-semibold text-accent-ink disabled:opacity-50`}
              >
                Importa {plural(stage.preview.books.length, "libro", "libri")}
              </button>
            </>
          )}
          {stage.kind === "done" && (
            <>
              <button type="button" onClick={() => setStage(pick)} className={`${button} border border-line-strong`}>
                Importa un altro file
              </button>
              <button type="button" onClick={close} className={`${button} bg-accent font-semibold text-accent-ink`}>
                Fatto
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
