import { NextResponse } from "next/server";

/**
 * Redirect a un percorso interno con `Location` relativo: il browser lo risolve
 * sull'indirizzo che sta usando. `new URL(path, request.url)` porterebbe invece a
 * `localhost` con `next start --hostname 127.0.0.1`, dove i cookie della sessione
 * (legati a 127.0.0.1) non arrivano.
 */
export const redirectToPath = (path: string, status: 303 | 307 = 307): NextResponse =>
  new NextResponse(null, { status, headers: { Location: path } });
