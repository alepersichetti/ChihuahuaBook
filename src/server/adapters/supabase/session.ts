import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { unauthenticated, unexpected } from "../../core/errors";
import type { Session } from "../../core/session";
import type { Supabase } from "./client";

const bearerToken = (request: Request) =>
  request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

// getClaims verifica il JWT (localmente se il progetto usa chiavi asimmetriche).
export const supabaseSession = (
  supabase: Supabase,
  request: Request,
): Session => ({
  userId: () =>
    ResultAsync.fromPromise(
      supabase.auth.getClaims(bearerToken(request)),
      unexpected,
    ).andThen(({ data }) =>
      data?.claims.sub ? okAsync(data.claims.sub) : errAsync(unauthenticated),
    ),
});
