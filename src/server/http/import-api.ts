import { ResultAsync } from "neverthrow";
import type { BookStore, CoverStore, ImportStore } from "../core/books/ports";
import { importBooks, pruneLibrary, setBookCover } from "../core/books/import";
import { unexpected, type AppError } from "../core/errors";
import type { Session } from "../core/session";
import { guarded, readJson } from "./guard";
import { route } from "./router";

export type ImportApiDeps = {
  readonly session: Session;
  readonly books: BookStore;
  readonly imports: ImportStore;
  readonly covers: CoverStore;
};

const readBytes = (request: Request): ResultAsync<Uint8Array, AppError> =>
  ResultAsync.fromPromise(
    request.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
    unexpected,
  );

const librarian = guarded<ImportApiDeps>("edit");

export const importRoutes = [
  // Un lotto di libri letti da un file .pedia; risponde con l'esito di ognuno.
  route<ImportApiDeps>(
    "POST",
    "/import/books",
    librarian(({ request, deps }) =>
      readJson(request).andThen(importBooks(deps.imports)),
    ),
  ),
  // Sostituzione della biblioteca: elimina i libri che non sono nel file (o li conta soltanto).
  route<ImportApiDeps>(
    "POST",
    "/import/prune",
    librarian(({ request, deps }) =>
      readJson(request).andThen(pruneLibrary(deps.imports, deps.covers)),
    ),
  ),
  // Il corpo è l'immagine stessa, con il suo Content-Type.
  route<ImportApiDeps>(
    "PUT",
    "/books/:id/cover",
    librarian(({ request, params, deps }) =>
      readBytes(request).andThen((bytes) =>
        setBookCover(deps.books, deps.covers)(
          params.id,
          request.headers.get("content-type"),
          bytes,
        ),
      ),
    ),
  ),
] as const;
