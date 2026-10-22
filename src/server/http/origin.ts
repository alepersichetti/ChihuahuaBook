const firstValue = (header: string | null): string | undefined => header?.split(",")[0]?.trim() || undefined;

/**
 * L'origine che il browser vede (es. `http://127.0.0.1:3100`), presa dagli header
 * Host / X-Forwarded-*. Non si usa `request.url`: con `next start --hostname 127.0.0.1`
 * Next lo costruisce con `localhost`, e dietro un proxy riporta l'indirizzo interno.
 */
export const requestOrigin = (request: Request): string => {
  const url = new URL(request.url);
  const host = firstValue(request.headers.get("x-forwarded-host")) ?? firstValue(request.headers.get("host"));
  const protocol = firstValue(request.headers.get("x-forwarded-proto")) ?? url.protocol.replace(/:$/, "");
  return host ? `${protocol}://${host}` : url.origin;
};
