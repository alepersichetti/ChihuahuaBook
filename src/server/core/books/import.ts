import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import { validationError, type AppError } from "../errors";
import { validate, type ValidationIssue } from "../result";
import { withDerivedIsbn, type Book } from "./book";
import type {
  BookStore,
  CatalogEntry,
  CoverStore,
  ImportedBook,
  ImportedRef,
  ImportStore,
} from "./ports";
import { bookIdSchema, bookInputSchema } from "./schema";

// Import a lotti: il browser legge il file e manda i libri a gruppi,
// così nessuna richiesta supera i limiti di dimensione dell'hosting.

export const importSources = ["bookpedia"] as const;
export const maxImportBatch = 100;

const importItemSchema = z.object({
  source_id: z.string().trim().min(1).max(200),
  book: z.unknown(),
  extra: z.record(z.string(), z.unknown()).default({}),
});

export const importRequestSchema = z.object({
  source: z.enum(importSources).default("bookpedia"),
  /**
   * Cosa fare con i libri già importati in passato dalla stessa fonte:
   * "update" li riscrive tutti, "changed" solo quelli la cui scheda è cambiata, "skip" nessuno.
   */
  on_existing: z.enum(["update", "changed", "skip"]).default("update"),
  items: z.array(importItemSchema).min(1).max(maxImportBatch),
});

export type ImportRequest = z.input<typeof importRequestSchema>;

export type ImportItemResult =
  | {
      readonly source_id: string;
      readonly status: "created" | "updated" | "unchanged" | "skipped";
      readonly id: string;
    }
  | {
      readonly source_id: string;
      readonly status: "failed";
      readonly issues: readonly ValidationIssue[];
    };

export type ImportReport = {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly skipped: number;
  readonly failed: number;
  readonly items: readonly ImportItemResult[];
};

const failed = (
  source_id: string,
  issues: readonly ValidationIssue[],
): ImportItemResult => ({ source_id, status: "failed", issues });

const messageOf = (error: AppError) =>
  error.kind === "validation"
    ? error.issues.map((issue) => issue.message).join("; ")
    : "message" in error
      ? error.message
      : error.kind;

const report = (items: readonly ImportItemResult[]): ImportReport => ({
  created: items.filter((item) => item.status === "created").length,
  updated: items.filter((item) => item.status === "updated").length,
  unchanged: items.filter((item) => item.status === "unchanged").length,
  skipped: items.filter((item) => item.status === "skipped").length,
  failed: items.filter((item) => item.status === "failed").length,
  items,
});

/** JSON con le chiavi in ordine: lo stesso contenuto dà sempre lo stesso testo. */
const stableJson = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stableJson).join(",")}]`
    : value !== null && typeof value === "object"
      ? `{${Object.keys(value)
          .toSorted()
          .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
          .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
          .join(",")}}`
      : JSON.stringify(value);

const fnv1a = (text: string, seed: number) =>
  [...text]
    .reduce((total, char) => Math.imul(total ^ char.charCodeAt(0), 16777619) >>> 0, seed)
    .toString(16)
    .padStart(8, "0");

/** Impronta a 64 bit (due FNV-1a con semi diversi): basta per accorgersi di una modifica. */
export const contentHash = (value: unknown): string => {
  const text = stableJson(value);
  return fnv1a(text, 2166136261) + fnv1a(text, 0x811c9dc5 ^ 0x5bd1e995);
};

type Indexed<T> = { readonly index: number; readonly value: T };

type Checked = {
  readonly valid: readonly Indexed<ImportedBook>[];
  readonly rejected: readonly Indexed<ImportItemResult>[];
};

/** Valida libro per libro: una scheda sbagliata non blocca le altre del lotto. */
const checkItems = (request: z.output<typeof importRequestSchema>): Checked => {
  const firstIndex = new Map(
    request.items.map((item, index) => [item.source_id, index] as const).reverse(),
  );
  return request.items.reduce<Checked>(
    (acc, item, index) =>
      firstIndex.get(item.source_id) !== index
        ? {
            ...acc,
            rejected: [
              ...acc.rejected,
              {
                index,
                value: failed(item.source_id, [
                  { path: "source_id", message: "Id ripetuto nello stesso lotto" },
                ]),
              },
            ],
          }
        : validate(bookInputSchema)(item.book).match<Checked>(
            (book) => ({
              ...acc,
              valid: [
                ...acc.valid,
                {
                  index,
                  value: {
                    ...withDerivedIsbn(book),
                    source: request.source,
                    source_id: item.source_id,
                    extra: item.extra,
                    import_hash: contentHash({ book, extra: item.extra }),
                  },
                },
              ],
            }),
            (issues) => ({
              ...acc,
              rejected: [
                ...acc.rejected,
                { index, value: failed(item.source_id, issues) },
              ],
            }),
          ),
    { valid: [], rejected: [] },
  );
};

const failedWith = (book: ImportedBook, error: AppError) =>
  failed(book.source_id, [{ path: "", message: messageOf(error) }]);

// Gli errori del magazzino diventano esiti "failed" dei singoli libri, mai del lotto intero.

const insertAll = (
  store: ImportStore,
  books: readonly Indexed<ImportedBook>[],
): ResultAsync<readonly Indexed<ImportItemResult>[], never> =>
  books.length === 0
    ? okAsync([])
    : ResultAsync.fromSafePromise(
        store.insertMany(books.map(({ value }) => value)).match(
          (refs) => {
            const idOf = new Map(refs.map((ref) => [ref.source_id, ref.id]));
            return books.map(({ index, value: book }) => {
              const id = idOf.get(book.source_id);
              return {
                index,
                value: id
                  ? { source_id: book.source_id, status: "created" as const, id }
                  : failed(book.source_id, [{ path: "", message: "Non salvato" }]),
              };
            });
          },
          (error) =>
            books.map(({ index, value }) => ({
              index,
              value: failedWith(value, error),
            })),
        ),
      );

const replaceOne = (
  store: ImportStore,
  id: string,
  { index, value: book }: Indexed<ImportedBook>,
): ResultAsync<Indexed<ImportItemResult>, never> =>
  ResultAsync.fromSafePromise(
    store.replace(id, book).match(
      () => ({
        index,
        value: { source_id: book.source_id, status: "updated" as const, id },
      }),
      (error) => ({ index, value: failedWith(book, error) }),
    ),
  );

const leftAlone = (
  status: "skipped" | "unchanged",
  id: string,
  { index, value: book }: Indexed<ImportedBook>,
): Indexed<ImportItemResult> => ({
  index,
  value: { source_id: book.source_id, status, id },
});

/**
 * Importa un lotto di libri. Chi c'è già (stessa fonte e stesso id d'origine)
 * viene aggiornato o lasciato com'è, quindi reimportare non crea doppioni.
 */
export const importBooks =
  (store: ImportStore) =>
  (input: unknown): ResultAsync<ImportReport, AppError> =>
    validate(importRequestSchema)(input)
      .mapErr(validationError)
      .asyncAndThen((request) => {
        const { valid, rejected } = checkItems(request);
        const lookup: ResultAsync<readonly ImportedRef[], AppError> =
          valid.length === 0
            ? okAsync([])
            : store.findBySource(
                request.source,
                valid.map(({ value }) => value.source_id),
              );
        return lookup.andThen((existing) => {
          const refOf = new Map(existing.map((ref) => [ref.source_id, ref]));
          const fresh = valid.filter(({ value }) => !refOf.has(value.source_id));
          const known = valid.flatMap((item) => {
            const ref = refOf.get(item.value.source_id);
            return ref ? [{ ref, item }] : [];
          });
          const untouched = ({ ref, item }: (typeof known)[number]) =>
            request.on_existing === "skip" ||
            (request.on_existing === "changed" && ref.import_hash === item.value.import_hash);
          const updates: ResultAsync<readonly Indexed<ImportItemResult>[], never> =
            ResultAsync.combine(
              known.map((entry) =>
                untouched(entry)
                  ? okAsync<Indexed<ImportItemResult>, never>(
                      leftAlone(
                        request.on_existing === "skip" ? "skipped" : "unchanged",
                        entry.ref.id,
                        entry.item,
                      ),
                    )
                  : replaceOne(store, entry.ref.id, entry.item),
              ),
            );
          return ResultAsync.combine([insertAll(store, fresh), updates] as const).map(
            ([created, updated]) =>
              report(
                // Esiti nello stesso ordine del lotto ricevuto.
                [...rejected, ...created, ...updated]
                  .toSorted((a, b) => a.index - b.index)
                  .map(({ value }) => value),
              ),
          );
        });
      });

// Sostituzione della biblioteca -------------------------------------------------

export const pruneRequestSchema = z.object({
  source: z.enum(importSources).default("bookpedia"),
  /** Gli id d'origine di tutte le schede del file: i libri corrispondenti restano. */
  keep_source_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(100_000),
  /** Per sicurezza, senza `dry_run: false` si conta soltanto. */
  dry_run: z.boolean().default(true),
});

export type PruneReport = {
  readonly dry_run: boolean;
  /** Libri che non sono nel file: eliminati, o da eliminare se dry_run. */
  readonly removed: number;
  readonly kept: number;
};

/** I libri della biblioteca che non vengono dal file: tutti quelli non abbinati a una sua scheda. */
export const booksToPrune = (
  catalog: readonly CatalogEntry[],
  source: string,
  keepSourceIds: ReadonlySet<string>,
): readonly CatalogEntry[] =>
  catalog.filter(
    (entry) =>
      !(entry.source === source && entry.source_id !== null && keepSourceIds.has(entry.source_id)),
  );

/**
 * Rende la biblioteca uguale al file importato eliminando i libri che non ci sono,
 * con le loro copertine. Va chiamato dopo aver importato tutte le schede.
 */
export const pruneLibrary =
  (store: Pick<ImportStore, "listAll" | "removeMany">, covers: Pick<CoverStore, "remove">) =>
  (input: unknown): ResultAsync<PruneReport, AppError> =>
    validate(pruneRequestSchema)(input)
      .mapErr(validationError)
      .asyncAndThen((request) =>
        store.listAll().andThen((catalog) => {
          const doomed = booksToPrune(catalog, request.source, new Set(request.keep_source_ids));
          const summary = {
            dry_run: request.dry_run,
            removed: doomed.length,
            kept: catalog.length - doomed.length,
          };
          if (request.dry_run || doomed.length === 0) return okAsync(summary);
          const paths = doomed.flatMap((entry) => (entry.cover_path ? [entry.cover_path] : []));
          return store
            .removeMany(doomed.map((entry) => entry.id))
            // Una copertina rimasta orfana non deve far sembrare fallita l'eliminazione.
            .andThen(() => (paths.length > 0 ? covers.remove(paths).orElse(() => okAsync(undefined)) : okAsync(undefined)))
            .map(() => summary);
        }),
      );

// Copertine ---------------------------------------------------------------------

export const coverTypes: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Stesso limite del bucket `covers` su Supabase. */
export const maxCoverBytes = 5 * 1024 * 1024;

const coverIssue = (message: string) =>
  errAsync(validationError([{ path: "cover", message }]));

/** Salva la copertina di un libro in `<libro>.<estensione>` e la collega al libro. */
export const setBookCover =
  (books: Pick<BookStore, "get" | "update">, covers: Pick<CoverStore, "put">) =>
  (
    id: unknown,
    contentType: string | null,
    bytes: Uint8Array,
  ): ResultAsync<Book, AppError> => {
    const type = contentType?.split(";")[0].trim().toLowerCase() ?? "";
    const extension = coverTypes[type];
    if (!extension) return coverIssue("Formato non supportato: usa JPEG, PNG o WebP");
    if (bytes.byteLength === 0) return coverIssue("Il file è vuoto");
    if (bytes.byteLength > maxCoverBytes) return coverIssue("Immagine oltre 5 MB");
    return validate(bookIdSchema)(id)
      .mapErr(validationError)
      .asyncAndThen(books.get)
      .andThen((book) =>
        covers
          .put(`${book.id}.${extension}`, bytes, type)
          .andThen((path) => books.update(book.id, { cover_path: path })),
      );
  };
