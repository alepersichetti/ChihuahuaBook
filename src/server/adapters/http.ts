import { errAsync, ResultAsync } from "neverthrow";
import type { AppError } from "../core/errors";

export const upstream = (message: string): AppError => ({
  kind: "upstream",
  message,
});

/** GET di un JSON da un servizio esterno, con timeout ed errori come valori. */
export const fetchJson =
  (fetchImpl: typeof fetch, service: string) =>
  (url: URL): ResultAsync<unknown, AppError> =>
    ResultAsync.fromPromise(
      fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }),
      (error) => upstream(String(error)),
    ).andThen((response) =>
      response.ok
        ? ResultAsync.fromPromise(response.json() as Promise<unknown>, (error) =>
            upstream(String(error)),
          )
        : errAsync(upstream(`${service} ha risposto ${response.status}`)),
    );

export const yearOf = (date: string | undefined): number | null => {
  const match = date?.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
};
