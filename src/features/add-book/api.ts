import type { Book as StoredBook, NewBook } from "@/server/core/books/book";
import type { SearchHit } from "@/server/core/books/ports";
import type { SearchField, SourceInfo } from "@/server/core/books/search";

// Chiamate all'API per la ricerca online e il salvataggio di un libro.

/** Descrizioni delle fonti note; il server decide quali sono attive. */
export const sourceDescriptions: Readonly<Record<string, string>> = {
  google_books:
    "Cerca nel testo completo dei libri e delle riviste che Google ha scansionato, convertito in testo con il riconoscimento ottico dei caratteri (OCR) e archiviato nel suo database digitale.",
  open_library:
    "Catalogo aperto e modificabile da tutti, che punta ad avere una pagina web per ogni libro mai pubblicato.",
};

export const defaultSources: readonly SourceInfo[] = [
  { id: "google_books", label: "Google Books" },
  { id: "open_library", label: "Open Library" },
];

type Options = { readonly fetch?: typeof fetch; readonly baseUrl?: string };

const errorText = (status: number, body: { error?: string; message?: string; issues?: { message: string }[] }) =>
  status === 401
    ? "Serve l'accesso per cercare online."
    : body.error === "misconfigured"
      ? (body.message ?? "Il server non è configurato.")
      : body.error === "upstream"
        ? "La fonte non risponde o ha esaurito la quota: riprova più tardi o scegline un'altra."
        : (body.issues?.[0]?.message ?? `Errore del server (${status})`);

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

const getJson = async <T>(url: string, init: RequestInit, fetcher: typeof fetch): Promise<Outcome<T> & { status?: number }> => {
  const response = await fetcher(url, { credentials: "same-origin", ...init }).catch((cause: unknown) => cause);
  if (!(response instanceof Response)) return { ok: false, message: "Rete non raggiungibile." };
  const body = await response.json().catch(() => ({}));
  return response.ok
    ? { ok: true, value: body as T }
    : { ok: false, message: errorText(response.status, body), status: response.status };
};

export const loadSources = async ({ fetch: fetcher = fetch, baseUrl = "" }: Options = {}) => {
  const result = await getJson<readonly SourceInfo[]>(`${baseUrl}/api/search/sources`, {}, fetcher);
  // Senza accesso o configurazione mostriamo comunque le fonti: l'errore arriverà alla ricerca.
  return result.ok && result.value.length > 0 ? result.value : defaultSources;
};

export const searchOnline = (
  query: { readonly source: string; readonly field: SearchField; readonly text: string },
  { fetch: fetcher = fetch, baseUrl = "" }: Options = {},
) => {
  const params = new URLSearchParams({ source: query.source, field: query.field, q: query.text });
  return getJson<readonly SearchHit[]>(`${baseUrl}/api/search?${params}`, {}, fetcher);
};

export type SaveResult =
  | { readonly kind: "saved"; readonly id: string }
  | { readonly kind: "local"; readonly message: string }
  | { readonly kind: "failed"; readonly message: string };

/** Salva sul server; se manca l'accesso o Supabase, il libro resta solo nel browser. */
export const saveBook = async (book: NewBook, { fetch: fetcher = fetch, baseUrl = "" }: Options = {}): Promise<SaveResult> => {
  const result = await getJson<StoredBook>(
    `${baseUrl}/api/books`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(book) },
    fetcher,
  );
  if (result.ok) return { kind: "saved", id: result.value.id };
  return result.status === 401 || result.status === 500 || result.status === undefined
    ? { kind: "local", message: result.message }
    : { kind: "failed", message: result.message };
};
