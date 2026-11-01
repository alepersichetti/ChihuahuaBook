import type { CustomColumn } from "./model";

// Salvataggio delle colonne personalizzate e dei loro valori sul server.
// Come per l'aggiunta dei libri, senza server (o con i dati di esempio) la modifica resta nel browser.

export type PersistResult = "saved" | "local" | "failed";

type Options = { readonly fetch?: typeof fetch; readonly baseUrl?: string };

// Senza accesso, senza Supabase o con un libro che il server non conosce, la modifica resta locale.
const localStatuses = new Set([401, 404]);

const send = async (url: string, init: RequestInit, fetcher: typeof fetch): Promise<PersistResult> => {
  const response = await fetcher(url, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...init,
  }).catch(() => null);
  if (!response) return "local";
  if (response.ok) return "saved";
  const body: { error?: string } = await response.json().catch(() => ({}));
  return localStatuses.has(response.status) || body.error === "misconfigured" ? "local" : "failed";
};

/** Il formato dell'API: i nomi dei campi come nel database. */
export const toColumnInput = (column: CustomColumn) => ({
  key: column.key,
  label: column.label,
  kind: column.kind,
  catalog_field: column.catalogField,
  extra_key: column.extraKey,
});

export const saveColumns = async (
  columns: readonly CustomColumn[],
  { fetch: fetcher = fetch, baseUrl = "" }: Options = {},
): Promise<PersistResult> =>
  columns.length === 0
    ? "saved"
    : send(`${baseUrl}/api/columns`, { method: "POST", body: JSON.stringify({ columns: columns.map(toColumnInput) }) }, fetcher);

export const removeColumn = (key: string, { fetch: fetcher = fetch, baseUrl = "" }: Options = {}) =>
  send(`${baseUrl}/api/columns/${encodeURIComponent(key)}`, { method: "DELETE" }, fetcher);

export const renameColumn = (key: string, label: string, { fetch: fetcher = fetch, baseUrl = "" }: Options = {}) =>
  send(`${baseUrl}/api/columns/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ label }) }, fetcher);

export const saveFieldValue = (
  bookId: string,
  key: string,
  value: string,
  { fetch: fetcher = fetch, baseUrl = "" }: Options = {},
) =>
  send(
    `${baseUrl}/api/books/${encodeURIComponent(bookId)}/fields/${encodeURIComponent(key)}`,
    { method: "PUT", body: JSON.stringify({ value: value.trim() === "" ? null : value.trim() }) },
    fetcher,
  );
