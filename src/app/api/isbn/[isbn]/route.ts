import { lookupIsbn } from "@/features/books/open-library";
import { createClient } from "@/lib/supabase/server";

// Restituisce una bozza di libro (non salvata) a partire dall'ISBN.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/isbn/[isbn]">,
) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { isbn } = await ctx.params;
  const result = await lookupIsbn(isbn);

  return result.match(
    (draft) =>
      draft
        ? Response.json(draft)
        : Response.json({ error: "not_found" }, { status: 404 }),
    (error) =>
      Response.json(
        { error: error.kind },
        { status: error.kind === "invalid_isbn" ? 400 : 502 },
      ),
  );
}
