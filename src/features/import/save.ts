import type { ImportItemResult, ImportReport } from "@/server/core/books/import";
import type { PediaBook } from "@/server/core/books/pedia";
import type { BundleFile } from "./bundle";

// Salvataggio sul server: libri a lotti, poi le copertine una per una.
// Ogni richiesta resta piccola, quindi niente limiti di dimensione dell'hosting.

export const bookBatchSize = 50;
const coverConcurrency = 4;
// Sotto il limite di 4,5 MB delle funzioni Vercel, con margine.
const maxDirectCoverBytes = 4 * 1024 * 1024;
const maxCoverSide = 1600;

export type SaveProgress = {
  readonly phase: "books" | "covers";
  readonly done: number;
  readonly total: number;
};

export type SaveProblem = { readonly title: string; readonly message: string };

export type SaveOutcome =
  | {
      readonly kind: "saved";
      readonly created: number;
      readonly updated: number;
      readonly skipped: number;
      readonly problems: readonly SaveProblem[];
      readonly coversUploaded: number;
      readonly coverProblems: readonly SaveProblem[];
    }
  | {
      readonly kind: "unavailable";
      readonly reason: "unauthenticated" | "misconfigured" | "error";
      readonly message: string;
    };

export type SaveOptions = {
  readonly books: readonly PediaBook[];
  readonly covers: ReadonlyMap<string, BundleFile>;
  readonly onExisting: "update" | "skip";
  readonly onProgress: (progress: SaveProgress) => void;
  readonly fetch?: typeof fetch;
  readonly prepareCover?: (blob: Blob) => Promise<Blob>;
  readonly baseUrl?: string;
};

const batches = <T>(values: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );

const unavailable = (status: number, body: { error?: string; message?: string }): SaveOutcome | null =>
  status === 401
    ? { kind: "unavailable", reason: "unauthenticated", message: "Serve l'accesso per salvare sul server." }
    : body.error === "misconfigured"
      ? { kind: "unavailable", reason: "misconfigured", message: body.message ?? "Supabase non è configurato." }
      : null;

const describeFailure = (item: ImportItemResult) =>
  item.status === "failed" ? item.issues.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message)).join("; ") : "";

/**
 * Esegue `work` su gruppi di al più `limit` elementi in parallelo, un gruppo dopo l'altro.
 * `onGroup` riceve quanti elementi sono stati completati finora.
 */
const inGroups = <T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
  onGroup: (done: number) => void,
): Promise<readonly R[]> =>
  batches(items, limit).reduce<Promise<readonly R[]>>(async (previous, group) => {
    const done = await previous;
    const results = [...done, ...(await Promise.all(group.map(work)))];
    onGroup(results.length);
    return results;
  }, Promise.resolve([]));

const directTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Le immagini troppo grandi o in formati che il bucket non accetta (TIFF, GIF, HEIC)
 * vengono ridisegnate in JPEG, se il browser le sa leggere.
 */
export const prepareCoverInBrowser = async (blob: Blob): Promise<Blob> => {
  if (directTypes.has(blob.type) && blob.size <= maxDirectCoverBytes) return blob;
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxCoverSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
};

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

type BooksSaved = { readonly results: readonly ImportItemResult[]; readonly problems: readonly SaveProblem[] };
type BatchOutcome = { readonly kind: "stop"; readonly outcome: SaveOutcome } | { readonly kind: "saved"; readonly saved: BooksSaved };

const failedBatch = (batch: readonly PediaBook[], index: number, message: string): BatchOutcome =>
  index === 0
    ? { kind: "stop", outcome: { kind: "unavailable", reason: "error", message } }
    : { kind: "saved", saved: { results: [], problems: batch.map((book) => ({ title: book.book.title, message })) } };

export const saveImport = async ({
  books,
  covers,
  onExisting,
  onProgress,
  fetch: fetcher = fetch,
  prepareCover = prepareCoverInBrowser,
  baseUrl = "",
}: SaveOptions): Promise<SaveOutcome> => {
  const titleOf = new Map(books.map((book) => [book.sourceId, book.book.title]));

  const saveBatch = async (batch: readonly PediaBook[], index: number): Promise<BatchOutcome> => {
    const response = await fetcher(`${baseUrl}/api/import/books`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        source: "bookpedia",
        on_existing: onExisting,
        items: batch.map(({ sourceId, book, extra }) => ({ source_id: sourceId, book, extra })),
      }),
    }).catch((cause: unknown) => cause);

    if (!(response instanceof Response)) return failedBatch(batch, index, `Rete non raggiungibile: ${errorMessage(response)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const stop = unavailable(response.status, body);
      return stop ? { kind: "stop", outcome: stop } : failedBatch(batch, index, `Errore del server (${response.status})`);
    }
    const report = body as ImportReport;
    return {
      kind: "saved",
      saved: {
        results: report.items,
        problems: report.items
          .filter((item) => item.status === "failed")
          .map((item) => ({ title: titleOf.get(item.source_id) ?? item.source_id, message: describeFailure(item) })),
      },
    };
  };

  // I lotti partono uno dopo l'altro: il primo che fallisce del tutto interrompe il salvataggio.
  const booksOutcome = await batches(books, bookBatchSize).reduce<Promise<BatchOutcome>>(
    async (previous, batch, index) => {
      const sofar = await previous;
      if (sofar.kind === "stop") return sofar;
      onProgress({ phase: "books", done: index * bookBatchSize, total: books.length });
      const next = await saveBatch(batch, index);
      return next.kind === "stop"
        ? next
        : {
            kind: "saved",
            saved: {
              results: [...sofar.saved.results, ...next.saved.results],
              problems: [...sofar.saved.problems, ...next.saved.problems],
            },
          };
    },
    Promise.resolve({ kind: "saved", saved: { results: [], problems: [] } }),
  );
  if (booksOutcome.kind === "stop") return booksOutcome.outcome;
  const { results, problems } = booksOutcome.saved;
  onProgress({ phase: "books", done: books.length, total: books.length });

  // Copertine solo per i libri creati o aggiornati: quelli saltati restano com'erano.
  const coverJobs = results.flatMap((item) => {
    const file = item.status === "created" || item.status === "updated" ? covers.get(item.source_id) : undefined;
    return file && item.status !== "failed" ? [{ id: item.id, sourceId: item.source_id, file }] : [];
  });
  onProgress({ phase: "covers", done: 0, total: coverJobs.length });
  const coverResults = await inGroups(
    coverJobs,
    coverConcurrency,
    (job): Promise<SaveProblem | null> => {
      const title = titleOf.get(job.sourceId) ?? job.sourceId;
      return prepareCover(job.file.blob)
        .then((image) =>
          fetcher(`${baseUrl}/api/books/${job.id}/cover`, {
            method: "PUT",
            headers: { "content-type": image.type },
            credentials: "same-origin",
            body: image,
          }),
        )
        .then((response) => (response.ok ? null : { title, message: `Copertina rifiutata (${response.status})` }))
        .catch((cause: unknown) => ({ title, message: `Copertina non leggibile: ${errorMessage(cause)}` }));
    },
    (done) => onProgress({ phase: "covers", done, total: coverJobs.length }),
  );
  const coverProblems = coverResults.filter((problem): problem is SaveProblem => problem !== null);

  return {
    kind: "saved",
    created: results.filter((item) => item.status === "created").length,
    updated: results.filter((item) => item.status === "updated").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    problems,
    coversUploaded: coverJobs.length - coverProblems.length,
    coverProblems,
  };
};
