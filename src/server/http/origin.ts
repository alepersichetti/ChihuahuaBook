// L'indirizzo con cui il browser ha raggiunto l'app. Next avviato con --hostname 127.0.0.1
// mette "localhost" in request.url: l'host vero è quello dell'header Host.

export const requestHost = (request: Request): string => request.headers.get("host") ?? new URL(request.url).host;

/** Un percorso dell'app come URL assoluto sullo stesso host che il browser sta usando. */
export const appUrl = (path: string, request: Request): URL => {
  const url = new URL(path, request.url);
  url.host = requestHost(request);
  return url;
};
