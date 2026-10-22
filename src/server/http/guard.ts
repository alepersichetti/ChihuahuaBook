import { ResultAsync } from "neverthrow";
import { authorize, type Action, type Viewer } from "../core/auth/roles";
import { validationError, type AppError } from "../core/errors";
import type { Session } from "../core/session";
import { respond } from "./responses";
import type { RouteContext } from "./router";

export const readJson = (request: Request): ResultAsync<unknown, AppError> =>
  ResultAsync.fromPromise(request.json(), () =>
    validationError([
      { path: "", message: "Il corpo deve essere JSON valido" },
    ]),
  );

/**
 * Rotta protetta: serve un membro attivo con un ruolo sufficiente per `action`.
 * La RLS ripete lo stesso controllo nel database.
 */
export const guarded =
  <D extends { readonly session: Session }>(action: Action) =>
  <T>(
    work: (
      context: RouteContext<D>,
      viewer: Viewer,
    ) => ResultAsync<T, AppError>,
    status = 200,
  ) =>
  (context: RouteContext<D>) =>
    respond(
      context.deps.session
        .viewer()
        .andThen(authorize(action))
        .andThen((viewer) => work(context, viewer)),
      status,
    );
