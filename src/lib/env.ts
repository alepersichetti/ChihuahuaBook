import { z } from "zod";

// L'integrazione Vercel–Supabase imposta NEXT_PUBLIC_SUPABASE_ANON_KEY;
// i progetti più recenti usano la publishable key. Accettiamo entrambe.
const schema = z.object({
  url: z.url(),
  key: z.string().min(1),
});

export function supabaseEnv() {
  const parsed = schema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Configurazione Supabase mancante: imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return parsed.data;
}
