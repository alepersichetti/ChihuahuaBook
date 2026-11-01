import type { ColumnStore } from "../core/columns/ports";
import { ensureColumns, listColumns, removeColumn, renameColumn, setFieldValue } from "../core/columns/use-cases";
import type { Session } from "../core/session";
import { guarded, readJson } from "./guard";
import { route } from "./router";

export type ColumnsApiDeps = {
  readonly session: Session;
  readonly columns: ColumnStore;
};

const reader = guarded<ColumnsApiDeps>("read");
const librarian = guarded<ColumnsApiDeps>("edit");

// Tutti i membri vedono le colonne; crearle, eliminarle e compilarle tocca a bibliotecari e admin.
export const columnsRoutes = [
  route<ColumnsApiDeps>(
    "GET",
    "/columns",
    reader(({ deps }) => listColumns(deps.columns)()),
  ),
  route<ColumnsApiDeps>(
    "POST",
    "/columns",
    librarian(({ request, deps }) => readJson(request).andThen(ensureColumns(deps.columns))),
  ),
  route<ColumnsApiDeps>(
    "PATCH",
    "/columns/:key",
    librarian(({ request, params, deps }) => readJson(request).andThen((body) => renameColumn(deps.columns)(params.key, body))),
  ),
  route<ColumnsApiDeps>(
    "DELETE",
    "/columns/:key",
    librarian(({ params, deps }) => removeColumn(deps.columns)(params.key), 204),
  ),
  route<ColumnsApiDeps>(
    "PUT",
    "/books/:id/fields/:key",
    librarian(
      ({ request, params, deps }) =>
        readJson(request).andThen((body) => setFieldValue(deps.columns)(params.id, params.key, body)),
      204,
    ),
  ),
] as const;
