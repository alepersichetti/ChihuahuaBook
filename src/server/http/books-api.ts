import { okAsync } from "neverthrow";
import type {
  BookStore,
  IsbnLookup,
  SearchSource,
} from "../core/books/ports";
import { listSources, searchBooks } from "../core/books/search";
import {
  createBook,
  getBook,
  inspectIsbn,
  listBooks,
  removeBook,
  updateBook,
} from "../core/books/use-cases";
import type { Session } from "../core/session";
import { guarded, readJson } from "./guard";
import { route } from "./router";

export type BooksApiDeps = {
  readonly session: Session;
  readonly books: BookStore;
  readonly lookupIsbn: IsbnLookup;
  /** Cataloghi esterni in cui cercare, nell'ordine in cui proporli. */
  readonly searchSources: readonly SearchSource[];
};

const reader = guarded<BooksApiDeps>("read");
const librarian = guarded<BooksApiDeps>("edit");

export const booksRoutes = [
  route<BooksApiDeps>(
    "GET",
    "/books",
    reader(({ request, deps }) =>
      listBooks(deps.books)(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    ),
  ),
  route<BooksApiDeps>(
    "POST",
    "/books",
    librarian(
      ({ request, deps }) => readJson(request).andThen(createBook(deps.books)),
      201,
    ),
  ),
  route<BooksApiDeps>(
    "GET",
    "/books/:id",
    reader(({ params, deps }) => getBook(deps.books)(params.id)),
  ),
  route<BooksApiDeps>(
    "PATCH",
    "/books/:id",
    librarian(({ request, params, deps }) =>
      readJson(request).andThen((patch) =>
        updateBook(deps.books)(params.id, patch),
      ),
    ),
  ),
  route<BooksApiDeps>(
    "DELETE",
    "/books/:id",
    librarian(({ params, deps }) => removeBook(deps.books)(params.id), 204),
  ),
  route<BooksApiDeps>(
    "GET",
    "/isbn/:isbn",
    reader(({ params, deps }) =>
      inspectIsbn(deps.lookupIsbn, deps.books)(params.isbn),
    ),
  ),
  route<BooksApiDeps>(
    "GET",
    "/search/sources",
    librarian(({ deps }) =>
      okAsync(listSources(deps.searchSources)),
    ),
  ),
  route<BooksApiDeps>(
    "GET",
    "/search",
    librarian(({ request, deps }) =>
      searchBooks(deps.searchSources)(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    ),
  ),
] as const;
