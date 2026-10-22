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

/** Esegue `work` su tutti gli elementi con al più `limit` operazioni in parallelo. */
const pool = async <T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async (_, lane) => {
    for (let index = lane; index < items.length; index += limit) {
      results[index] = await work(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
};

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
  const results: ImportItemResult[] = [];
  const problems: SaveProblem[] = [];

  for (const [index, batch] of batches(books, bookBatchSize).entries()) {
    onProgress({ phase: "books", done: index * bookBatchSize, total: books.length });
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

    if (!(response instanceof Response)) {
      const message = `Rete non raggiungibile: ${errorMessage(response)}`;
      if (index === 0) return { kind: "unavailable", reason: "error", message };
      problems.push(...batch.map((book) => ({ title: book.book.title, message })));
      continue;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const stop = unavailable(response.status, body);
      if (stop) return stop;
      const message = `Errore del server (${response.status})`;
      if (index === 0) return { kind: "unavailable", reason: "error", message };
      problems.push(...batch.map((book) => ({ title: book.book.title, message })));
      continue;
    }
    const report = body as ImportReport;
    results.push(...report.items);
    problems.push(
      ...report.items
        .filter((item) => item.status === "failed")
        .map((item) => ({ title: titleOf.get(item.source_id) ?? item.source_id, message: describeFailure(item) })),
    );
  }
  onProgress({ phase: "books", done: books.length, total: books.length });

  // Copertine solo per i libri creati o aggiornati: quelli saltati restano com'erano.
  const coverJobs = results.flatMap((item) => {
    const file = item.status === "created" || item.status === "updated" ? covers.get(item.source_id) : undefined;
    return file && item.status !== "failed" ? [{ id: item.id, sourceId: item.source_id, file }] : [];
  });
  let coversDone = 0;
  onProgress({ phase: "covers", done: 0, total: coverJobs.length });
  const coverResults = await pool(coverJobs, coverConcurrency, async (job): Promise<SaveProblem | null> => {
    const title = titleOf.get(job.sourceId) ?? job.sourceId;
    const outcome = await prepareCover(job.file.blob)
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
    coversDone += 1;
    onProgress({ phase: "covers", done: coversDone, total: coverJobs.length });
    return outcome;
  });
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
