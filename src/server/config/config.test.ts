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

  it("legge gli indirizzi alternativi dei cataloghi, sempre con la barra finale", () => {
    expect(
      readConfig({
        SUPABASE_URL: "https://a.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "key",
        GOOGLE_BOOKS_API_URL: "http://127.0.0.1:4010/google",
        OPEN_LIBRARY_URL: "http://127.0.0.1:4010/openlibrary/",
      })._unsafeUnwrap(),
    ).toMatchObject({
      googleBooksUrl: "http://127.0.0.1:4010/google/",
      openLibraryUrl: "http://127.0.0.1:4010/openlibrary/",
    });
  });

  it("segnala la configurazione mancante", () => {
    expect(readConfig({}).isErr()).toBe(true);
  });
});
