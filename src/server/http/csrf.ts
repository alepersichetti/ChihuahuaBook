import { json } from "./responses";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protezione CSRF per le richieste che modificano dati con la sessione nei cookie:
 * il browser deve dichiarare la stessa origine (Origin o Sec-Fetch-Site).
 * Chi si autentica con `Authorization: Bearer` non usa cookie e non è esposto.
 */
export const isSameOriginRequest = (request: Request): boolean => {
  if (safeMethods.has(request.method)) return true;
  if (request.headers.has("authorization")) return true;
  if (!request.headers.has("cookie")) return true;
  const origin = request.headers.get("origin");
  if (origin) return origin === new URL(request.url).origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
};

export const sameOriginOnly =
  (handler: (request: Request) => Promise<Response>) =>
  (request: Request): Promise<Response> =>
    isSameOriginRequest(request)
      ? handler(request)
      : Promise.resolve(json({ error: "cross_origin" }, 403));
