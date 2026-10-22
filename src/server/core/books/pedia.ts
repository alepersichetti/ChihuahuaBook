import type { Result } from "neverthrow";
import { validate, type ValidationIssue } from "../result";
import { withDerivedIsbn, type NewBook } from "./book";
import { parseIsbn } from "./isbn";
import { bookInputSchema, type BookInput, type ReadStatus } from "./schema";

/**
 * Una scheda letta da un file .pedia di Bookpedia, già tolta dall'XML:
 * nome del campo come compare nel file, valori come testo.
 */
export type PediaRecord = Readonly<Record<string, readonly string[]>>;

/** Un libro pronto da importare, con l'identificativo stabile che evita i doppioni. */
export type PediaBook = {
  readonly sourceId: string;
  readonly book: NewBook;
  /** Campi del file che il catalogo non ha: restano nella colonna `extra`. */
  readonly extra: Readonly<Record<string, string | readonly string[]>>;
  /** Nomi con cui cercare la copertina nella cartella del bundle, in ordine di affidabilità. */
  readonly coverHints: readonly string[];
};

export type PediaRecordError = {
  readonly index: number;
  readonly title: string | null;
  readonly issues: readonly ValidationIssue[];
};

/** Nome del campo senza maiuscole, spazi né punteggiatura: "Release Date" → "releasedate". */
export const normalizeKey = (key: string): string =>
  key
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Nomi con cui Bookpedia (e le sue versioni) chiama i campi, già normalizzati.
const aliases = {
  sourceId: ["uid", "uuid", "collectionid", "pediaid", "entryid", "id"],
  title: ["title", "booktitle", "name"],
  subtitle: ["subtitle"],
  authors: ["author", "authors", "creator", "creators", "by"],
  editors: ["editor", "editors"],
  translators: ["translator", "translators"],
  illustrators: ["illustrator", "illustrators", "artist", "artists"],
  publisher: ["publisher", "publishedby", "label"],
  year: [
    "releasedate",
    "published",
    "publishdate",
    "publicationdate",
    "datepublished",
    "pubdate",
    "year",
    "releaseyear",
    "copyright",
  ],
  edition: ["edition"],
  isbn: ["isbn", "isbn13", "isbn10", "ean", "upc", "barcode"],
  pages: ["pages", "pagecount", "numberofpages", "length"],
  format: ["format", "binding", "media", "type"],
  language: ["language", "languages"],
  genres: ["genre", "genres", "category", "categories", "subject", "subjects"],
  series: ["series", "seriesname"],
  seriesNumber: ["volume", "seriesnumber", "seriesindex", "seriesvolume"],
  summary: ["summary", "plot", "description", "synopsis", "overview"],
  notes: ["notes", "note", "comments", "comment", "personalnotes"],
  tags: ["tags", "tag", "keywords", "keyword"],
  location: ["location", "shelf", "storagelocation"],
  condition: ["condition"],
  signed: ["signed", "autographed"],
  purchasedOn: [
    "purchasedate",
    "purchasedon",
    "datepurchased",
    "dateacquired",
    "acquired",
  ],
  purchasedFrom: ["purchasedfrom", "purchaseplace", "store", "vendor", "seller"],
  price: ["price", "purchaseprice", "pricepaid", "cost"],
  value: ["value", "estimatedvalue", "currentvalue", "marketvalue"],
  rating: ["rating", "myrating", "personalrating", "userrating"],
  read: ["read", "haveread", "readstatus", "status"],
  startedOn: ["startedreading", "datestarted", "startdate", "readstart"],
  finishedOn: [
    "dateread",
    "readdate",
    "finishedreading",
    "datefinished",
    "finishdate",
    "readon",
  ],
  favorite: ["favorite", "favourite", "favorites"],
  cover: ["coverimage", "cover", "coverfile", "coverpath", "image", "imagefile"],
} as const satisfies Record<string, readonly string[]>;

type Field = keyof typeof aliases;

const fieldOfKey: ReadonlyMap<string, Field> = new Map(
  (Object.entries(aliases) as [Field, readonly string[]][]).flatMap(
    ([field, keys]) => keys.map((key) => [key, field] as const),
  ),
);

/** Raccoglie i valori della scheda per campo del catalogo; il resto finisce in `extra`. */
const groupFields = (record: PediaRecord) =>
  Object.entries(record).reduce(
    (acc, [key, values]) => {
      const cleaned = values.map((value) => value.trim()).filter(Boolean);
      if (cleaned.length === 0) return acc;
      const field = fieldOfKey.get(normalizeKey(key));
      return field
        ? {
            ...acc,
            known: {
              ...acc.known,
              [field]: [...(acc.known[field] ?? []), ...cleaned],
            },
          }
        : {
            ...acc,
            extra: {
              ...acc.extra,
              [key]: cleaned.length === 1 ? cleaned[0] : cleaned,
            },
          };
    },
    {
      known: {} as Partial<Record<Field, readonly string[]>>,
      extra: {} as Record<string, string | readonly string[]>,
    },
  );

// Conversioni tolleranti: un valore che non si capisce diventa null, non un errore.

const first = (values: readonly string[] | undefined) => values?.[0] ?? null;

const splitList = (separators: RegExp) => (values: readonly string[] | undefined) =>
  [
    ...new Set(
      (values ?? [])
        .flatMap((value) => value.split(separators))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

// Le persone non si dividono sulla virgola: "Calvino, Italo" è un nome solo.
const people = splitList(/\r?\n|;/);
const labels = splitList(/\r?\n|;|,/);

const pad = (value: number) => String(value).padStart(2, "0");

const isoDate = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    year >= 1000
    ? `${year}-${pad(month)}-${pad(day)}`
    : null;
};

const monthNames: Readonly<Record<string, number>> = {
  jan: 1, gen: 1, feb: 2, mar: 3, apr: 4, may: 5, mag: 5, jun: 6, giu: 6,
  jul: 7, lug: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, ott: 10,
  nov: 11, dec: 12, dic: 12,
};

/** Date nei formati che si trovano negli export: ISO, gg/mm/aaaa, "Dec 12, 2004", "12 dic 2004". */
export const parseDate = (raw: string | null): string | null => {
  if (!raw) return null;
  const value = raw.trim();
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (numeric) {
    const [a, b] = [Number(numeric[1]), Number(numeric[2])];
    // Giorno prima del mese, salvo quando il "giorno" non può essere un mese (formato USA).
    return b > 12
      ? isoDate(Number(numeric[3]), a, b)
      : isoDate(Number(numeric[3]), b, a);
  }
  const named = value
    .toLowerCase()
    .match(/^(?:(\d{1,2})\s+([a-z]+)\.?|([a-z]+)\.?\s+(\d{1,2}),?)\s+(\d{4})/);
  if (named) {
    const month = monthNames[(named[2] ?? named[3]).slice(0, 3)];
    const day = Number(named[1] ?? named[4]);
    return month ? isoDate(Number(named[5]), month, day) : null;
  }
  return null;
};

const parseYear = (raw: string | null): number | null => {
  const match = raw?.match(/(?:^|\D)(\d{4})(?:\D|$)/);
  const year = match ? Number(match[1]) : null;
  return year !== null && year >= 0 && year <= 9999 ? year : null;
};

/** Numeri scritti all'italiana o all'inglese, con o senza simbolo di valuta. */
export const parseNumber = (raw: string | null): number | null => {
  if (!raw) return null;
  const digits = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(digits)) return null;
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  const normalized =
    lastComma > lastDot
      ? digits.replace(/\./g, "").replace(",", ".")
      : digits.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const currencySymbols: ReadonlyArray<readonly [RegExp, string]> = [
  [/€|\bEUR\b/i, "EUR"],
  [/£|\bGBP\b/i, "GBP"],
  [/\bCHF\b/i, "CHF"],
  [/\$|\bUSD\b/i, "USD"],
];

const currencyOf = (values: readonly (string | null)[]) =>
  currencySymbols.find(([pattern]) =>
    values.some((value) => value && pattern.test(value)),
  )?.[1] ?? null;

const money = (raw: string | null) => {
  const value = parseNumber(raw);
  return value !== null && value >= 0 ? Math.round(value * 100) / 100 : null;
};

const truthy = /^(1|y|yes|true|s|si|sì|x|checked|on|read|letto)$/i;

const parseBool = (raw: string | null) => (raw ? truthy.test(raw.trim()) : false);

const positiveInt = (raw: string | null) => {
  const value = parseNumber(raw);
  return value !== null && value > 0 ? Math.round(value) : null;
};

/** Il voto può arrivare in stelle (0–5), mezze stelle o decimi (0–10). */
const parseRating = (raw: string | null) => {
  const value = parseNumber(raw);
  if (value === null || value < 0) return null;
  const stars = value > 5 ? value / 2 : value;
  return stars <= 5 ? Math.round(stars) : null;
};

const readStatusOf = (
  raw: string | null,
  finishedOn: string | null,
): ReadStatus => {
  const value = raw?.trim().toLowerCase() ?? "";
  if (/reading|in lettura|sto leggendo|current/.test(value)) return "reading";
  if (/abandon|abbandon|dnf/.test(value)) return "abandoned";
  if (/unread|non letto|^no$|^0$|false|to read|da leggere/.test(value))
    return finishedOn ? "read" : "unread";
  return parseBool(raw) || /^read|letto/.test(value) || finishedOn
    ? "read"
    : "unread";
};

/** Hash FNV-1a in base 36: identificativo stabile per le schede senza id. */
const fingerprint = (text: string) =>
  [...text]
    .reduce(
      (total, char) => Math.imul(total ^ char.charCodeAt(0), 16777619) >>> 0,
      2166136261,
    )
    .toString(36);

const fileBaseName = (path: string) =>
  path.split(/[\\/]/).pop()?.replace(/\.[a-z0-9]+$/i, "") ?? path;

const blankToNull = (value: string | null) => (value?.trim() ? value.trim() : null);

/** Trasforma una scheda in un libro del catalogo, senza perdere i campi sconosciuti. */
export const mapPediaRecord = (
  record: PediaRecord,
  index: number,
): Result<Omit<PediaBook, "sourceId"> & { readonly sourceId: string | null }, PediaRecordError> => {
  const { known, extra } = groupFields(record);
  const get = (field: Field) => blankToNull(first(known[field]));

  const isbns = (known.isbn ?? []).map((raw) => parseIsbn(raw));
  const isbn = isbns.find((parsed) => parsed !== null) ?? null;
  const badIsbn = isbn ? [] : (known.isbn ?? []);

  const started = parseDate(get("startedOn"));
  const finished = parseDate(get("finishedOn"));
  const inOrder = !started || !finished || started <= finished;
  const seriesNumber = parseNumber(get("seriesNumber"));

  const draft: BookInput = {
    title: get("title") ?? "",
    subtitle: get("subtitle"),
    authors: people(known.authors),
    editors: people(known.editors),
    translators: people(known.translators),
    illustrators: people(known.illustrators),
    publisher: get("publisher"),
    published_year: parseYear(get("year")),
    edition: get("edition"),
    isbn13: isbn?.isbn13 ?? null,
    isbn10: isbn?.isbn10 ?? null,
    pages: positiveInt(get("pages")),
    format: get("format"),
    language: get("language"),
    genres: labels(known.genres),
    series: get("series"),
    series_number:
      seriesNumber !== null && seriesNumber >= 0 && seriesNumber < 10000
        ? seriesNumber
        : null,
    summary: known.summary?.join("\n\n") ?? null,
    notes: known.notes?.join("\n\n") ?? null,
    read_status: readStatusOf(get("read"), finished),
    started_reading_on: started,
    finished_reading_on: inOrder ? finished : null,
    rating: parseRating(get("rating")),
    favorite: parseBool(get("favorite")),
    tags: labels(known.tags),
    location: get("location"),
    condition: get("condition"),
    signed: parseBool(get("signed")),
    purchased_on: parseDate(get("purchasedOn")),
    purchased_from: get("purchasedFrom"),
    purchase_price: money(get("price")),
    estimated_value: money(get("value")),
    currency: currencyOf([get("price"), get("value")]),
  };

  // Ciò che non è entrato nel libro resta leggibile in `extra`.
  const leftovers = {
    ...extra,
    ...(badIsbn.length > 0 ? { isbn: badIsbn } : {}),
    ...(known.sourceId && known.sourceId.length > 1
      ? { ids: known.sourceId }
      : {}),
    ...(!inOrder && finished ? { dateRead: finished } : {}),
  };

  const rawSourceId = get("sourceId");
  const coverHints = [
    ...(known.cover ?? []).map(fileBaseName),
    ...(known.sourceId ?? []),
    ...(isbn ? [isbn.isbn13, isbn.isbn10].filter((v): v is string => !!v) : []),
    ...(draft.title ? [draft.title] : []),
  ];

  return validate(bookInputSchema)(draft)
    .map((book) => ({
      sourceId: rawSourceId,
      book: withDerivedIsbn(book),
      extra: leftovers,
      coverHints: [...new Set(coverHints)],
    }))
    .mapErr((issues) => ({ index, title: draft.title || null, issues }));
};

const fallbackId = (book: NewBook) =>
  `h:${fingerprint(
    [book.title, book.authors.join("|"), book.isbn13 ?? ""]
      .join("§")
      .toLowerCase(),
  )}`;

/**
 * Trasforma tutte le schede di un file. Le schede senza id ricevono un'impronta
 * stabile (titolo, autori, ISBN), così reimportare lo stesso file non crea doppioni.
 * Due schede con lo stesso id (es. due copie identiche) restano distinte: "#2", "#3"...
 */
export const mapPediaRecords = (
  records: readonly PediaRecord[],
): {
  readonly books: readonly PediaBook[];
  readonly errors: readonly PediaRecordError[];
} => {
  const results = records.map(mapPediaRecord);
  const mapped = results.flatMap((result) =>
    result.isOk()
      ? [{ ...result.value, base: result.value.sourceId ?? fallbackId(result.value.book) }]
      : [],
  );
  const copyOf = new Map(
    [...Map.groupBy(mapped, (item) => item.base).values()].flatMap((copies) =>
      copies.map((item, copy) => [item, copy] as const),
    ),
  );
  const books = mapped.map(({ base, ...item }, index) => {
    const copy = copyOf.get(mapped[index]) ?? 0;
    return { ...item, sourceId: copy === 0 ? base : `${base}#${copy + 1}` };
  });
  return {
    books,
    errors: results.flatMap((result) => (result.isErr() ? [result.error] : [])),
  };
};
