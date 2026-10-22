import type { EmailOtpType } from "@supabase/supabase-js";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/server/platform/next/access";

const otpTypes = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

const checked = (promise: Promise<{ error: unknown }>) =>
  ResultAsync.fromSafePromise(promise).andThen(({ error }) => (error ? errAsync("invalid") : okAsync(undefined)));

// Arrivo dai link delle email di Supabase (conferma account, recupero password).
// Accetta sia il flusso PKCE (?code=) sia quello con token_hash dei template email.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const verified = await createClient().andThen((supabase) =>
    code
      ? checked(supabase.auth.exchangeCodeForSession(code))
      : tokenHash && type && otpTypes.has(type)
        ? checked(supabase.auth.verifyOtp({ token_hash: tokenHash, type }))
        : errAsync("invalid"),
  );

  const target = verified.isOk() ? new URL(next, request.url) : new URL("/login?error=link", request.url);
  return NextResponse.redirect(target);
}
