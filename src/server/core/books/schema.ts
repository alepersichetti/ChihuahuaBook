import { z } from "zod";
import { cleanIsbn, isValidIsbn10, isValidIsbn13 } from "./isbn";

export const readStatuses = ["unread", "reading", "read", "abandoned"] as const;

export type ReadStatus = (typeof readStatuses)[number];

// Stringa facoltativa: spazi rimossi, stringa vuota diventa null.
const text = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish();

const names = z
  .array(z.string().trim())
  .transform((values) => values.filter((value) => value !== ""));

const isoDate = z.iso.date().nullish();

const money = z.number().nonnegative().multipleOf(0.01).nullish();

const bookFields = z.object({
  title: z.string().trim().min(1, "Il titolo è obbligatorio"),
  subtitle: text,
  authors: names,
  editors: names,
  translators: names,
  illustrators: names,
  publisher: text,
  published_year: z.int().min(0).max(9999).nullish(),
  edition: text,
  isbn13: z
    .string()
    .transform(cleanIsbn)
    .refine(isValidIsbn13, "ISBN-13 non valido")
    .nullish(),
  isbn10: z
    .string()
    .transform(cleanIsbn)
    .refine(isValidIsbn10, "ISBN-10 non valido")
    .nullish(),
  pages: z.int().positive().nullish(),
  format: text,
  language: text,
  genres: names,
  series: text,
  series_number: z.number().nonnegative().nullish(),
  summary: text,
  cover_path: text,
  cover_url: z.url().nullish(),
  read_status: z.enum(readStatuses),
  started_reading_on: isoDate,
  finished_reading_on: isoDate,
  rating: z.int().min(0).max(5).nullish(),
  favorite: z.boolean(),
  notes: text,
  tags: names,
  location: text,
  condition: text,
  signed: z.boolean(),
  purchased_on: isoDate,
  purchased_from: text,
  purchase_price: money,
  estimated_value: money,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Codice valuta ISO 4217 (es. EUR)")
    .nullish(),
});

const readingDatesInOrder = (book: {
  started_reading_on?: string | null;
  finished_reading_on?: string | null;
}) =>
  !book.started_reading_on ||
  !book.finished_reading_on ||
  book.started_reading_on <= book.finished_reading_on;

const readingDatesMessage = {
  message: "La fine lettura non può precedere l'inizio",
  path: ["finished_reading_on"],
};

// I default valgono solo in creazione: una patch non deve azzerare campi non inviati.
export const bookInputSchema = bookFields
  .extend({
    authors: names.default([]),
    editors: names.default([]),
    translators: names.default([]),
    illustrators: names.default([]),
    genres: names.default([]),
    tags: names.default([]),
    read_status: bookFields.shape.read_status.default("unread"),
    favorite: z.boolean().default(false),
    signed: z.boolean().default(false),
  })
  .refine(readingDatesInOrder, readingDatesMessage);

export const bookUpdateSchema = bookFields
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Nessun campo da aggiornare",
  )
  .refine(readingDatesInOrder, readingDatesMessage);

export type BookInput = z.input<typeof bookInputSchema>;
export type BookUpdate = z.input<typeof bookUpdateSchema>;

export const bookSorts = [
  "created_at",
  "title",
  "published_year",
  "rating",
] as const;

// Parametri di ricerca: arrivano come stringhe (es. da una query string).
export const listBooksQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(readStatuses).optional(),
  tag: z.string().trim().min(1).optional(),
  favorite: z.stringbool().optional(),
  collection: z.uuid().optional(),
  sort: z.enum(bookSorts).default("created_at"),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const bookIdSchema = z.uuid();
