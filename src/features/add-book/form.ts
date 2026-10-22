import { parseIsbn } from "@/server/core/books/isbn";
import { bookInputSchema, type BookInput } from "@/server/core/books/schema";
import type { NewBook } from "@/server/core/books/book";
import type { Book } from "../library/model";

// Il modulo lavora con stringhe, come i campi di testo; la validazione
// riusa lo stesso schema del server, così i messaggi coincidono.

export type BookForm = {
  readonly title: string;
  readonly subtitle: string;
  readonly authors: string;
  readonly publisher: string;
  readonly year: string;
  readonly isbn: string;
  readonly pages: string;
  readonly language: string;
  readonly genres: string;
  readonly summary: string;
  readonly coverUrl: string;
};

export type FormIssues = Readonly<Partial<Record<keyof BookForm, string>>>;

export const emptyForm: BookForm = {
  title: "",
  subtitle: "",
  authors: "",
  publisher: "",
  year: "",
  isbn: "",
  pages: "",
  language: "",
  genres: "",
  summary: "",
  coverUrl: "",
};

const list = (values: readonly string[] | undefined) => (values ?? []).join(", ");
const textOf = (value: string | number | null | undefined) => (value == null ? "" : String(value));

/** Da una bozza (es. Google Books) al modulo da rivedere. */
export const formFromDraft = (draft: BookInput): BookForm => ({
  title: draft.title,
  subtitle: textOf(draft.subtitle),
  authors: list(draft.authors),
  publisher: textOf(draft.publisher),
  year: textOf(draft.published_year),
  isbn: textOf(draft.isbn13 ?? draft.isbn10),
  pages: textOf(draft.pages),
  language: textOf(draft.language),
  genres: list(draft.genres),
  summary: textOf(draft.summary),
  coverUrl: textOf(draft.cover_url),
});

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const wholeNumber = (value: string) => (value.trim() === "" ? null : Number(value.trim()));

// Percorsi dello schema che corrispondono ai campi del modulo.
const fieldOf: Readonly<Record<string, keyof BookForm>> = {
  title: "title",
  subtitle: "subtitle",
  authors: "authors",
  publisher: "publisher",
  published_year: "year",
  isbn13: "isbn",
  isbn10: "isbn",
  pages: "pages",
  language: "language",
  genres: "genres",
  summary: "summary",
  cover_url: "coverUrl",
};

export type FormResult =
  | { readonly ok: true; readonly book: NewBook }
  | { readonly ok: false; readonly issues: FormIssues };

export const validateForm = (form: BookForm): FormResult => {
  const isbn = form.isbn.trim() === "" ? null : parseIsbn(form.isbn);
  if (form.isbn.trim() !== "" && !isbn) return { ok: false, issues: { isbn: "ISBN non valido" } };
  const parsed = bookInputSchema.safeParse({
    title: form.title,
    subtitle: form.subtitle,
    authors: splitList(form.authors),
    publisher: form.publisher,
    published_year: wholeNumber(form.year),
    isbn13: isbn?.isbn13 ?? null,
    isbn10: isbn?.isbn10 ?? null,
    pages: wholeNumber(form.pages),
    language: form.language,
    genres: splitList(form.genres),
    summary: form.summary,
    cover_url: form.coverUrl.trim() || null,
  });
  if (parsed.success) return { ok: true, book: parsed.data };
  const issues = parsed.error.issues.reduce<Partial<Record<keyof BookForm, string>>>((found, issue) => {
    const field = fieldOf[String(issue.path[0])] ?? "title";
    return found[field] ? found : { ...found, [field]: issue.message };
  }, {});
  return { ok: false, issues };
};

/** Il libro appena aggiunto nel modello di vista, per mostrarlo subito. */
export const toLibraryBook = (id: string, book: NewBook, addedAt: string): Book => ({
  id,
  title: book.title,
  subtitle: book.subtitle ?? null,
  sortTitle: null,
  authors: book.authors,
  publisher: book.publisher ?? null,
  publishedYear: book.published_year ?? null,
  isbn13: book.isbn13 ?? null,
  pages: book.pages ?? null,
  format: book.format ?? null,
  language: book.language ?? null,
  genres: book.genres,
  series: book.series ?? null,
  seriesNumber: book.series_number ?? null,
  summary: book.summary ?? null,
  notes: book.notes ?? null,
  tags: book.tags,
  location: book.location ?? null,
  coverUrl: book.cover_url ?? null,
  readStatus: book.read_status,
  rating: book.rating ?? null,
  favorite: book.favorite,
  wishlist: false,
  loan: null,
  addedAt,
});
