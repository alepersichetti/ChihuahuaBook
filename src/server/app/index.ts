import { googleBooksSource } from "../adapters/google-books/search";
import { openLibraryLookup } from "../adapters/open-library/lookup";
import { openLibrarySource } from "../adapters/open-library/search";
import { supabaseBookStore } from "../adapters/supabase/book-store";
import {
  supabaseCoverStore,
  supabaseImportStore,
} from "../adapters/supabase/import-store";
import { supabaseForRequest } from "../adapters/supabase/client";
import { supabaseMemberStore } from "../adapters/supabase/member-store";
import { supabaseSession } from "../adapters/supabase/session";
import { readConfig, type Config } from "../config";
import { adminRoutes, type AdminApiDeps } from "../http/admin-api";
import { booksRoutes, type BooksApiDeps } from "../http/books-api";
import { importRoutes, type ImportApiDeps } from "../http/import-api";
import { sameOriginOnly } from "../http/csrf";
import { json } from "../http/responses";
import { router } from "../http/router";

export type AppHandler = (request: Request) => Promise<Response>;

type AppDeps = BooksApiDeps & ImportApiDeps & AdminApiDeps;

/** Composizione: collega gli adattatori reali ai casi d'uso. */
export const createApp = (
  config: Config,
  options: { readonly basePath?: string; readonly fetch?: typeof fetch } = {},
): AppHandler =>
  sameOriginOnly(
    router<AppDeps>(
      options.basePath ?? "/api",
      [...booksRoutes, ...importRoutes, ...adminRoutes],
      (request) => {
        const supabase = supabaseForRequest(config, request);
        return {
          session: supabaseSession(supabase, request),
          books: supabaseBookStore(supabase),
          imports: supabaseImportStore(supabase),
          covers: supabaseCoverStore(supabase),
          members: supabaseMemberStore(supabase),
          lookupIsbn: openLibraryLookup(options.fetch),
          searchSources: [
            googleBooksSource({
              apiKey: config.googleBooksApiKey,
              fetch: options.fetch,
            }),
            openLibrarySource({ fetch: options.fetch }),
          ],
        };
      },
    ),
  );

/** Come createApp, ma legge la configurazione dalle variabili d'ambiente. */
export const appFromEnv = (
  env: Readonly<Record<string, string | undefined>>,
  options?: Parameters<typeof createApp>[1],
): AppHandler =>
  readConfig(env).match(
    (config) => createApp(config, options),
    (message) => async () => json({ error: "misconfigured", message }, 500),
  );
