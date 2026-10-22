import { describe, expect, it } from "vitest";
import { readConfig } from ".";

describe("readConfig", () => {
  it("preferisce le variabili senza prefisso e accetta la anon key", () => {
    expect(
      readConfig({
        SUPABASE_URL: "https://a.supabase.co",
        NEXT_PUBLIC_SUPABASE_URL: "https://b.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      })._unsafeUnwrap(),
    ).toEqual({ supabaseUrl: "https://a.supabase.co", supabaseKey: "anon" });
  });

  it("segnala la configurazione mancante", () => {
    expect(readConfig({}).isErr()).toBe(true);
  });
});
