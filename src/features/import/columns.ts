import { normalizeKey, pediaFieldOf, type PediaField, type PediaRecord } from "@/server/core/books/pedia";
import type { Messages } from "../i18n/messages";
import { columnKeyOf, customColumnId, isIsoDate, numericValue } from "../library/columns";
import { columnKeys, type ColumnId, type ColumnKey, type CustomColumn, type CustomColumnKind } from "../library/model";

// Le colonne di un file .pedia: ogni campo del file diventa una colonna della tabella.
// I campi che la tabella ha già (titolo, autore...) usano quelle; gli altri diventano
// colonne personalizzate, create se mancano.

// Dove finisce ogni campo che il catalogo riconosce: una colonna fissa della tabella,
// una colonna personalizzata che legge il campo del catalogo, oppure da nessuna parte.
const targets: Readonly<Record<PediaField, ColumnKey | { readonly catalog: string } | null>> = {
  sourceId: null,
  cover: null,
  title: "title",
  subtitle: "subtitle",
  authors: "authors",
  publisher: "publisher",
  year: "publishedYear",
  isbn: "isbn13",
  pages: "pages",
  format: "format",
  language: "language",
  genres: "genres",
  series: "series",
  seriesNumber: "series",
  summary: "summary",
  notes: "notes",
  tags: "tags",
  location: "location",
  ratingTenths: "rating",
  rating: "rating",
  read: "readStatus",
  editors: { catalog: "editors" },
  translators: { catalog: "translators" },
  illustrators: { catalog: "illustrators" },
  edition: { catalog: "edition" },
  condition: { catalog: "condition" },
  signed: { catalog: "signed" },
  purchasedOn: { catalog: "purchased_on" },
  purchasedFrom: { catalog: "purchased_from" },
  price: { catalog: "purchase_price" },
  value: { catalog: "estimated_value" },
  startedOn: { catalog: "started_reading_on" },
  finishedOn: { catalog: "finished_reading_on" },
  favorite: { catalog: "favorite" },
};

// Bookpedia scrive la data di inserimento in un campo che il catalogo tiene in `extra`.
const builtinExtra: Readonly<Record<string, ColumnKey>> = { dateadded: "addedAt" };

type Destination =
  | { readonly kind: "builtin"; readonly column: ColumnKey }
  | {
      readonly kind: "custom";
      readonly key: string;
      readonly label: string;
      readonly catalogField: string | null;
      readonly extraKey: string | null;
    }
  | { readonly kind: "skip" };

/** "placePublished" → "Place Published": i nomi del file, leggibili. */
export const humanize = (name: string) => {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const destinationOf = (fileKey: string, t: Messages): Destination => {
  const normalized = normalizeKey(fileKey);
  const field = pediaFieldOf(fileKey);
  if (field) {
    const target = targets[field];
    if (target === null) return { kind: "skip" };
    if (typeof target === "string") return { kind: "builtin", column: target };
    return { kind: "custom", key: normalizeKey(field), label: t.catalogFields[field as keyof Messages["catalogFields"]] ?? humanize(field), catalogField: target.catalog, extraKey: null };
  }
  if (builtinExtra[normalized]) return { kind: "builtin", column: builtinExtra[normalized] };
  const key = columnKeyOf(fileKey);
  if (key === "") return { kind: "skip" };
  // Il catalogo salva questi campi in `extra` col nome del file: la colonna lo ricorda.
  return { kind: "custom", key, label: t.pediaFields[key] ?? humanize(fileKey), catalogField: null, extraKey: fileKey };
};

/** Un valore conta come dato se non è vuoto e non è lo 0 con cui Bookpedia scrive "no" o "nessuno". */
const meaningful = (value: string) => {
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== "0";
};

type CustomStats = {
  readonly key: string;
  readonly label: string;
  readonly catalogField: string | null;
  readonly extraKey: string | null;
  hasData: boolean;
  allDates: boolean;
  allNumbers: boolean;
  anyValue: boolean;
};

export type PediaColumnPlan = {
  /** Tutte le colonne personalizzate del file, già esistenti o nuove. */
  readonly custom: readonly CustomColumn[];
  /** Quelle che la biblioteca non aveva. */
  readonly added: readonly CustomColumn[];
  /** Le colonne da mostrare: quelle con almeno un valore, fisse prima, poi nell'ordine del file. */
  readonly visible: readonly ColumnId[];
  /** Nome del campo nel file (normalizzato) → chiave della colonna personalizzata. */
  readonly keyOfField: ReadonlyMap<string, string>;
};

const kindOf = (stats: CustomStats): CustomColumnKind =>
  !stats.anyValue ? "text" : stats.allDates ? "date" : stats.allNumbers ? "number" : "text";

/**
 * Esamina tutte le schede e decide le colonne. Le colonne che esistono già
 * (stessa chiave) restano come sono: nome e tipo li ha scelti chi le ha create.
 */
export const pediaColumns = (
  records: readonly PediaRecord[],
  existing: readonly CustomColumn[],
  t: Messages,
): PediaColumnPlan => {
  const builtinData = new Set<ColumnKey>(["title"]);
  const stats = new Map<string, CustomStats>();
  const keyOfField = new Map<string, string>();
  const destinations = new Map<string, Destination>();

  for (const record of records) {
    for (const [fileKey, values] of Object.entries(record)) {
      const normalized = normalizeKey(fileKey);
      const destination = destinations.get(normalized) ?? destinationOf(fileKey, t);
      destinations.set(normalized, destination);
      const filled = values.filter(meaningful);
      if (destination.kind === "builtin") {
        if (filled.length > 0) builtinData.add(destination.column);
        continue;
      }
      if (destination.kind === "skip") continue;
      keyOfField.set(normalized, destination.key);
      const current =
        stats.get(destination.key) ??
        { key: destination.key, label: destination.label, catalogField: destination.catalogField, extraKey: destination.extraKey, hasData: false, allDates: true, allNumbers: true, anyValue: false };
      stats.set(destination.key, current);
      for (const value of values.map((item) => item.trim()).filter(Boolean)) {
        current.anyValue = true;
        current.allDates &&= isIsoDate(value);
        current.allNumbers &&= numericValue(value) !== null;
      }
      if (filled.length > 0) current.hasData = true;
    }
  }

  const byKey = new Map(existing.map((column) => [column.key, column]));
  const fileColumns = [...stats.values()];
  const custom = fileColumns.map(
    (item): CustomColumn =>
      byKey.get(item.key) ?? { key: item.key, label: item.label, kind: kindOf(item), catalogField: item.catalogField, extraKey: item.extraKey },
  );
  return {
    custom,
    added: custom.filter((column) => !byKey.has(column.key)),
    visible: [
      ...columnKeys.filter((column) => builtinData.has(column)),
      ...fileColumns.filter((item) => item.hasData).map((item) => customColumnId(item.key)),
    ],
    keyOfField,
  };
};

/** I valori delle colonne personalizzate per una scheda, come testo da mostrare; lo 0 di Bookpedia vale vuoto. */
export const pediaFieldValues = (record: PediaRecord, plan: Pick<PediaColumnPlan, "keyOfField">): Record<string, string> => {
  const grouped = new Map<string, string[]>();
  for (const [fileKey, values] of Object.entries(record)) {
    const key = plan.keyOfField.get(normalizeKey(fileKey));
    const filled = values.filter(meaningful).map((value) => value.trim());
    if (!key || filled.length === 0) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), ...filled]);
  }
  return Object.fromEntries([...grouped].map(([key, values]) => [key, [...new Set(values)].join(", ")]));
};
