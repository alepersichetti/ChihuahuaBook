// Quali pagine si aprono senza sessione. Tutto il resto porta al login.
// L'API (/api) risponde da sola con 401, senza redirect.
const publicPaths: ReadonlySet<string> = new Set(["/login", "/manifest.webmanifest", "/robots.txt"]);
const publicPrefixes = ["/auth/", "/api/"] as const;

export const isPublicPath = (pathname: string): boolean =>
  publicPaths.has(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix));

/**
 * Dove tornare dopo il login: solo percorsi interni, mai URL esterni
 * (evita open redirect tipo `?next=//evil.example`).
 */
export const safeNextPath = (next: string | null | undefined): string =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";

export const loginUrl = (requestUrl: string): URL => {
  const current = new URL(requestUrl);
  const target = new URL("/login", current);
  const back = current.pathname + current.search;
  if (back !== "/") target.searchParams.set("next", back);
  return target;
};
