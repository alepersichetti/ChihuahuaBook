import { errAsync, ResultAsync } from "neverthrow";
import type { AppError, UpstreamReason } from "../core/errors";

export const upstream = (message: string, reason?: UpstreamReason): AppError =>
  reason ? { kind: "upstream", message, reason } : { kind: "upstream", message };

type FetchOptions = {
  readonly headers?: Readonly<Record<string, string>>;
  /** Spiega una risposta d'errore a partire dal corpo, se il servizio lo permette. */
  readonly explain?: (status: number, body: unknown) => UpstreamReason | undefined;
};

/** GET di un JSON da un servizio esterno, con timeout ed errori come valori. */
export const fetchJson =
  (fetchImpl: typeof fetch, service: string, options: FetchOptions = {}) =>
  (url: URL): ResultAsync<unknown, AppError> =>
    ResultAsync.fromPromise(
      fetchImpl(url, {
        headers: { Accept: "application/json", ...options.headers },
        signal: AbortSignal.timeout(8000),
      }),
      (error) => upstream(String(error)),
    ).andThen((response) =>
      response.ok
        ? ResultAsync.fromPromise(response.json() as Promise<unknown>, (error) =>
            upstream(String(error)),
          )
        : ResultAsync.fromSafePromise(response.json().catch(() => null) as Promise<unknown>).andThen(
            (body) =>
              errAsync(
                upstream(
                  `${service} ha risposto ${response.status}`,
                  options.explain?.(response.status, body),
                ),
              ),
          ),
    );

export const yearOf = (date: string | undefined): number | null => {
  const match = date?.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
};
