import { ResultAsync } from "neverthrow";
import type { BookStore, CoverStore, ImportStore } from "../core/books/ports";
import { importBooks, setBookCover } from "../core/books/import";
import { unexpected, validationError, type AppError } from "../core/errors";
import type { Session } from "../core/session";
import { respond } from "./responses";
import { route, type RouteContext } from "./router";

export type ImportApiDeps = {
  readonly session: Session;
  readonly books: BookStore;
  readonly imports: ImportStore;
  readonly covers: CoverStore;
};

type Context = RouteContext<ImportApiDeps>;

const readJson = (request: Request): ResultAsync<unknown, AppError> =>
  ResultAsync.fromPromise(request.json(), () =>
    validationError([
      { path: "", message: "Il corpo deve essere JSON valido" },
    ]),
  );

const readBytes = (request: Request): ResultAsync<Uint8Array, AppError> =>
  ResultAsync.fromPromise(
    request.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
    unexpected,
  );

const authenticated =
  <T>(work: (context: Context, userId: string) => ResultAsync<T, AppError>) =>
  (context: Context) =>
    respond(
      context.deps.session.userId().andThen((userId) => work(context, userId)),
    );

export const importRoutes = [
  // Un lotto di libri letti da un file .pedia; risponde con l'esito di ognuno.
  route<ImportApiDeps>(
    "POST",
    "/import/books",
    authenticated(({ request, deps }) =>
      readJson(request).andThen(importBooks(deps.imports)),
    ),
  ),
  // Il corpo è l'immagine stessa, con il suo Content-Type.
  route<ImportApiDeps>(
    "PUT",
    "/books/:id/cover",
    authenticated(({ request, params, deps }, userId) =>
      readBytes(request).andThen((bytes) =>
        setBookCover(deps.books, deps.covers)(
          userId,
          params.id,
          request.headers.get("content-type"),
          bytes,
        ),
      ),
    ),
  ),
] as const;
