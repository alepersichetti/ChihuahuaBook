import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { isRole } from "../../core/auth/roles";
import { forbidden, unauthenticated, unexpected } from "../../core/errors";
import type { Session } from "../../core/session";
import type { Supabase } from "./client";

const bearerToken = (request: Request) =>
  request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

// getClaims verifica il JWT (localmente se il progetto usa chiavi asimmetriche);
// il ruolo arriva dal database, la stessa fonte che usa la RLS.
export const supabaseSession = (
  supabase: Supabase,
  request: Request,
): Session => ({
  viewer: () =>
    ResultAsync.fromPromise(
      supabase.auth.getClaims(bearerToken(request)),
      unexpected,
    )
      .andThen(({ data }) =>
        data?.claims.sub ? okAsync(data.claims.sub) : errAsync(unauthenticated),
      )
      .andThen((userId) =>
        ResultAsync.fromPromise(
          Promise.resolve(supabase.rpc("member_role")),
          unexpected,
        ).andThen(({ data, error }) =>
          error
            ? errAsync(unexpected(error.message))
            : isRole(data)
              ? okAsync({ userId, role: data })
              : errAsync(forbidden),
        ),
      ),
});
