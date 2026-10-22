import { okAsync, ResultAsync } from "neverthrow";
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
import { validationError, type AppError } from "../core/errors";
import type { Session } from "../core/session";
import { respond } from "./responses";
import { route, type RouteContext } from "./router";

export type BooksApiDeps = {
  readonly session: Session;
  readonly books: BookStore;
  readonly lookupIsbn: IsbnLookup;
  /** Cataloghi esterni in cui cercare, nell'ordine in cui proporli. */
  readonly searchSources: readonly SearchSource[];
};

type Context = RouteContext<BooksApiDeps>;

const readJson = (request: Request): ResultAsync<unknown, AppError> =>
  ResultAsync.fromPromise(request.json(), () =>
    validationError([
      { path: "", message: "Il corpo deve essere JSON valido" },
    ]),
  );

// Ogni rotta richiede un utente: l'isolamento dei dati lo garantisce la RLS.
const authenticated =
  <T>(work: (context: Context) => ResultAsync<T, AppError>, status = 200) =>
  (context: Context) =>
    respond(
      context.deps.session.userId().andThen(() => work(context)),
      status,
    );

export const booksRoutes = [
  route<BooksApiDeps>(
    "GET",
    "/books",
    authenticated(({ request, deps }) =>
      listBooks(deps.books)(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    ),
  ),
  route<BooksApiDeps>(
    "POST",
    "/books",
    authenticated(
      ({ request, deps }) => readJson(request).andThen(createBook(deps.books)),
      201,
    ),
  ),
  route<BooksApiDeps>(
    "GET",
    "/books/:id",
    authenticated(({ params, deps }) => getBook(deps.books)(params.id)),
  ),
  route<BooksApiDeps>(
    "PATCH",
    "/books/:id",
    authenticated(({ request, params, deps }) =>
      readJson(request).andThen((patch) =>
        updateBook(deps.books)(params.id, patch),
      ),
    ),
  ),
  route<BooksApiDeps>(
    "DELETE",
    "/books/:id",
    authenticated(({ params, deps }) => removeBook(deps.books)(params.id), 204),
  ),
  route<BooksApiDeps>(
    "GET",
    "/isbn/:isbn",
    authenticated(({ params, deps }) =>
      inspectIsbn(deps.lookupIsbn, deps.books)(params.isbn),
    ),
  ),
  route<BooksApiDeps>(
    "GET",
    "/search/sources",
    authenticated(({ deps }) =>
      okAsync(listSources(deps.searchSources)),
    ),
  ),
  route<BooksApiDeps>(
    "GET",
    "/search",
    authenticated(({ request, deps }) =>
      searchBooks(deps.searchSources)(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    ),
  ),
] as const;
