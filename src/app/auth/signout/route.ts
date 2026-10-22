import { ResultAsync } from "neverthrow";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/server/http/csrf";
import { redirectToPath } from "@/server/platform/next/redirect";

// L'uscita è un POST dalla stessa origine: un link esterno non può disconnettere nessuno.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "cross_origin" }, { status: 403 });
  }
  await createClient().andThen((supabase) => ResultAsync.fromSafePromise(supabase.auth.signOut()));
  return redirectToPath("/login", 303);
}
