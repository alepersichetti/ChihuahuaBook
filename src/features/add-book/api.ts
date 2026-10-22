import type { Book as StoredBook, NewBook } from "@/server/core/books/book";
import type { SearchHit } from "@/server/core/books/ports";
import type { SearchField, SourceInfo } from "@/server/core/books/search";
import type { UpstreamReason } from "@/server/core/errors";

// Chiamate all'API per la ricerca online e il salvataggio di un libro.
// Gli errori sono codici: i testi, nella lingua dell'interfaccia, li sceglie la UI.

export const defaultSources: readonly SourceInfo[] = [
  { id: "google_books", label: "Google Books" },
  { id: "open_library", label: "Open Library" },
];

export type ApiError =
  | { readonly kind: "unauthenticated" | "forbidden" | "misconfigured" | "network" | "invalid" }
  | { readonly kind: "upstream"; readonly reason?: UpstreamReason }
  | { readonly kind: "server"; readonly status: number };

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

type Options = { readonly fetch?: typeof fetch; readonly baseUrl?: string };

const upstreamReasons: readonly UpstreamReason[] = ["key_missing", "key_invalid", "key_restricted", "api_disabled", "quota"];

const upstreamOf = (reason: unknown): ApiError => {
  const known = upstreamReasons.find((item) => item === reason);
  return known ? { kind: "upstream", reason: known } : { kind: "upstream" };
};

const errorOf = (status: number, body: { error?: string; reason?: unknown }): ApiError =>
  status === 401
    ? { kind: "unauthenticated" }
    : status === 403
      ? { kind: "forbidden" }
      : body.error === "misconfigured"
        ? { kind: "misconfigured" }
        : body.error === "upstream"
          ? upstreamOf(body.reason)
          : status === 400
            ? { kind: "invalid" }
            : { kind: "server", status };

const call = async <T>(url: string, init: RequestInit, fetcher: typeof fetch): Promise<Outcome<T>> => {
  const response = await fetcher(url, { credentials: "same-origin", ...init }).catch((cause: unknown) => cause);
  if (!(response instanceof Response)) return { ok: false, error: { kind: "network" } };
  const body = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, value: body as T } : { ok: false, error: errorOf(response.status, body) };
};

export const loadSources = async ({ fetch: fetcher = fetch, baseUrl = "" }: Options = {}) => {
  const result = await call<readonly SourceInfo[]>(`${baseUrl}/api/search/sources`, {}, fetcher);
  // Senza accesso o configurazione mostriamo comunque le fonti: l'errore arriverà alla ricerca.
  return result.ok && result.value.length > 0 ? result.value : defaultSources;
};

export const searchOnline = (
  query: { readonly source: string; readonly field: SearchField; readonly text: string },
  { fetch: fetcher = fetch, baseUrl = "" }: Options = {},
) => {
  const params = new URLSearchParams({ source: query.source, field: query.field, q: query.text });
  return call<readonly SearchHit[]>(`${baseUrl}/api/search?${params}`, {}, fetcher);
};

export type SaveResult =
  | { readonly kind: "saved"; readonly id: string }
  | { readonly kind: "local"; readonly error: ApiError }
  | { readonly kind: "failed"; readonly error: ApiError };

// Senza accesso o senza Supabase il libro resta nel browser, come per l'import.
const keepsLocally = new Set<ApiError["kind"]>(["unauthenticated", "misconfigured", "network"]);

/** Salva sul server; se il server non è disponibile, il libro resta solo nel browser. */
export const saveBook = async (book: NewBook, { fetch: fetcher = fetch, baseUrl = "" }: Options = {}): Promise<SaveResult> => {
  const result = await call<StoredBook>(
    `${baseUrl}/api/books`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(book) },
    fetcher,
  );
  if (result.ok) return { kind: "saved", id: result.value.id };
  return keepsLocally.has(result.error.kind) ? { kind: "local", error: result.error } : { kind: "failed", error: result.error };
};

/** Carica la copertina scelta dal disco per un libro già salvato sul server. */
export const uploadCover = async (
  bookId: string,
  image: Blob,
  { fetch: fetcher = fetch, baseUrl = "" }: Options = {},
): Promise<Outcome<unknown>> =>
  call<unknown>(
    `${baseUrl}/api/books/${encodeURIComponent(bookId)}/cover`,
    { method: "PUT", headers: { "content-type": image.type }, body: image },
    fetcher,
  );
