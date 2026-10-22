import type { ResultAsync } from "neverthrow";
import type { AppError } from "../core/errors";

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status });

const statusOf: { readonly [K in AppError["kind"]]: number } = {
  validation: 400,
  unauthenticated: 401,
  not_found: 404,
  conflict: 409,
  upstream: 502,
  unexpected: 500,
};

export const errorResponse = (error: AppError): Response =>
  json(
    error.kind === "validation"
      ? { error: error.kind, issues: error.issues }
      : { error: error.kind },
    statusOf[error.kind],
  );

/** Chiude un ResultAsync in una Response: unico punto in cui gli errori diventano HTTP. */
export const respond = <T>(
  result: ResultAsync<T, AppError>,
  status = 200,
): Promise<Response> =>
  result.match(
    (value) =>
      status === 204 ? new Response(null, { status }) : json(value, status),
    errorResponse,
  );
