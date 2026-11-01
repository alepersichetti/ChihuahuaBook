import { normalizeKey } from "@/server/core/books/pedia";
import type { Messages } from "../i18n/messages";
import { columnKeys, type ColumnId, type ColumnKey, type CustomColumn, type CustomColumnId, type CustomColumnKind } from "./model";

// Colonne della tabella: quelle fisse del catalogo più quelle personalizzate della biblioteca.

const prefix = "field:";

export const customColumnId = (key: string): CustomColumnId => `${prefix}${key}`;

export const isCustomColumn = (column: ColumnId): column is CustomColumnId => column.startsWith(prefix);

/** La chiave della colonna personalizzata, o null per una colonna fissa. */
export const customKeyOf = (column: ColumnId): string | null => (isCustomColumn(column) ? column.slice(prefix.length) : null);

export const isColumnKey = (column: string): column is ColumnKey => (columnKeys as readonly string[]).includes(column);

/** La chiave di una colonna dal suo nome: niente maiuscole, accenti, spazi né punteggiatura. */
export const columnKeyOf = (label: string) => normalizeKey(label).slice(0, 60);

export const findCustomColumn = (columns: readonly CustomColumn[], column: ColumnId) => {
  const key = customKeyOf(column);
  return key === null ? undefined : columns.find((item) => item.key === key);
};

/** Il nome da mostrare: tradotto per le colonne fisse, scelto dall'utente per le altre. */
export const columnLabel = (column: ColumnId, customColumns: readonly CustomColumn[], t: Messages): string => {
  const key = customKeyOf(column);
  if (key === null) return t.columns[column as ColumnKey];
  return customColumns.find((item) => item.key === key)?.label ?? key;
};

/** Tutte le colonne che si possono mostrare, nell'ordine del menu Colonne. */
export const allColumns = (customColumns: readonly CustomColumn[]): readonly ColumnId[] => [
  ...columnKeys,
  ...customColumns.map((column) => customColumnId(column.key)),
];

export type NewColumnProblem = "empty" | "exists";

/**
 * Una nuova colonna dal nome scelto dall'utente. Il nome non può ripetere
 * quello di un'altra colonna, nemmeno di una fissa (nella lingua dell'interfaccia).
 */
export const newCustomColumn = (
  label: string,
  kind: CustomColumnKind,
  existing: readonly CustomColumn[],
  t: Messages,
): { readonly ok: true; readonly column: CustomColumn } | { readonly ok: false; readonly problem: NewColumnProblem } => {
  const name = label.trim().replace(/\s+/g, " ").slice(0, 80);
  const key = columnKeyOf(name);
  if (key === "") return { ok: false, problem: "empty" };
  const taken = new Set([
    ...existing.map((column) => column.key),
    ...columnKeys.map((column) => columnKeyOf(t.columns[column])),
  ]);
  return taken.has(key)
    ? { ok: false, problem: "exists" }
    : { ok: true, column: { key, label: name, kind, catalogField: null, extraKey: key } };
};

/** Aggiunge le colonne che mancano (stessa chiave = stessa colonna) e lascia le altre come sono. */
export const mergeCustomColumns = (
  current: readonly CustomColumn[],
  incoming: readonly CustomColumn[],
): readonly CustomColumn[] => {
  const known = new Set(current.map((column) => column.key));
  const added = incoming.filter((column) => {
    if (known.has(column.key)) return false;
    known.add(column.key);
    return true;
  });
  return added.length === 0 ? current : [...current, ...added];
};

const numberPattern = /^-?\d+(?:[.,]\d+)?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Il numero scritto nella cella, se è proprio un numero ("12", "3,5"). */
export const numericValue = (value: string): number | null =>
  numberPattern.test(value.trim()) ? Number(value.trim().replace(",", ".")) : null;

export const isIsoDate = (value: string) => datePattern.test(value.trim());

/** Il tipo che descrive meglio tutti i valori: data, numero o testo. */
export const kindOfValues = (values: readonly string[]): CustomColumnKind => {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  if (filled.length === 0) return "text";
  if (filled.every(isIsoDate)) return "date";
  if (filled.every((value) => numericValue(value) !== null)) return "number";
  return "text";
};

/** Il valore da mostrare nella cella, nella lingua dell'interfaccia. */
export const formatCustomValue = (value: string | undefined, kind: CustomColumnKind, locale: string): string => {
  if (!value) return "";
  if (kind === "date" && isIsoDate(value)) {
    // Conta il giorno scritto nel file: l'ora (e il suo fuso) non deve spostarlo.
    const date = new Date(`${value.trim().slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { timeZone: "UTC" });
  }
  const number = kind === "number" ? numericValue(value) : null;
  // Senza separatore delle migliaia: spesso sono codici o anni (es. il "dogTag" di Bookpedia).
  return number === null ? value : number.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 6 });
};

// Dal database --------------------------------------------------------------------

/** Una riga di `custom_columns` nel modello di vista. */
export const customColumnFromRow = (row: {
  readonly key: string;
  readonly label: string;
  readonly kind: CustomColumnKind;
  readonly catalog_field: string | null;
  readonly extra_key: string | null;
}): CustomColumn => ({
  key: row.key,
  label: row.label,
  kind: row.kind,
  catalogField: row.catalog_field,
  extraKey: row.extra_key,
});

const asText = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(asText).filter(Boolean).join(", ")
    : typeof value === "string"
      ? value.trim()
      : typeof value === "number"
        ? String(value)
        : value === true
          ? "1"
          : "";

/**
 * I valori delle colonne personalizzate per una riga di `books`: da `extra`
 * (chiave confrontata senza maiuscole né spazi) o dal campo del catalogo indicato.
 */
export const bookFieldsFromRow = (
  row: { readonly extra: unknown } & Readonly<Record<string, unknown>>,
  columns: readonly CustomColumn[],
): Record<string, string> => {
  const extra = row.extra && typeof row.extra === "object" ? (row.extra as Record<string, unknown>) : {};
  const extraByKey = new Map(Object.entries(extra).map(([name, value]) => [columnKeyOf(name), value]));
  return Object.fromEntries(
    columns.flatMap((column) => {
      const text = asText(
        column.catalogField
          ? row[column.catalogField]
          : column.extraKey && column.extraKey in extra
            ? extra[column.extraKey]
            : extraByKey.get(column.key),
      );
      return text ? [[column.key, text]] : [];
    }),
  );
};
