import { json } from "./responses";

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type RouteContext<D> = {
  readonly request: Request;
  readonly params: Readonly<Record<string, string>>;
  readonly deps: D;
};

export type Route<D> = {
  readonly method: Method;
  readonly segments: readonly string[];
  readonly handle: (context: RouteContext<D>) => Promise<Response>;
};

const split = (path: string) => path.split("/").filter(Boolean);

export const route = <D>(
  method: Method,
  pattern: string,
  handle: Route<D>["handle"],
): Route<D> => ({ method, segments: split(pattern), handle });

// ":nome" cattura un segmento; tutto il resto deve coincidere.
const matchSegments = (
  pattern: readonly string[],
  path: readonly string[],
): Record<string, string> | null =>
  pattern.length !== path.length
    ? null
    : pattern.reduce<Record<string, string> | null>(
        (params, segment, index) =>
          params === null
            ? null
            : segment.startsWith(":")
              ? {
                  ...params,
                  [segment.slice(1)]: decodeURIComponent(path[index]),
                }
              : segment === path[index]
                ? params
                : null,
        {},
      );

/**
 * Router minimo su Request/Response standard: funziona su qualsiasi runtime
 * con le Web API (Node, Vercel, Deno, Bun, Cloudflare Workers).
 * Le dipendenze si risolvono a ogni richiesta, solo se una rotta corrisponde.
 */
export const router =
  <D>(
    basePath: string,
    routes: readonly Route<D>[],
    resolveDeps: (request: Request) => D,
  ) =>
  async (request: Request): Promise<Response> => {
    const base = split(basePath);
    const path = split(new URL(request.url).pathname);
    const relative = base.every((segment, index) => path[index] === segment)
      ? path.slice(base.length)
      : null;
    if (!relative) return json({ error: "not_found" }, 404);

    const matches = routes
      .map((candidate) => ({
        candidate,
        params: matchSegments(candidate.segments, relative),
      }))
      .filter(({ params }) => params !== null);

    const hit = matches.find(
      ({ candidate }) => candidate.method === request.method,
    );
    if (!hit) {
      return matches.length > 0
        ? json({ error: "method_not_allowed" }, 405)
        : json({ error: "not_found" }, 404);
    }

    return hit.candidate.handle({
      request,
      params: hit.params ?? {},
      deps: resolveDeps(request),
    });
  };
