import { openLibraryLookup } from "../adapters/open-library/lookup";
import { supabaseBookStore } from "../adapters/supabase/book-store";
import { supabaseForRequest } from "../adapters/supabase/client";
import { supabaseSession } from "../adapters/supabase/session";
import { readConfig, type Config } from "../config";
import { booksRoutes, type BooksApiDeps } from "../http/books-api";
import { json } from "../http/responses";
import { router } from "../http/router";

export type AppHandler = (request: Request) => Promise<Response>;

/** Composizione: collega gli adattatori reali ai casi d'uso. */
export const createApp = (
  config: Config,
  options: { readonly basePath?: string; readonly fetch?: typeof fetch } = {},
): AppHandler =>
  router<BooksApiDeps>(options.basePath ?? "/api", booksRoutes, (request) => {
    const supabase = supabaseForRequest(config, request);
    return {
      session: supabaseSession(supabase, request),
      books: supabaseBookStore(supabase),
      lookupIsbn: openLibraryLookup(options.fetch),
    };
  });

/** Come createApp, ma legge la configurazione dalle variabili d'ambiente. */
export const appFromEnv = (
  env: Readonly<Record<string, string | undefined>>,
  options?: Parameters<typeof createApp>[1],
): AppHandler =>
  readConfig(env).match(
    (config) => createApp(config, options),
    (message) => async () => json({ error: "misconfigured", message }, 500),
  );
