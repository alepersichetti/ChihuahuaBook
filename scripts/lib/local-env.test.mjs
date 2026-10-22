import { describe, expect, it } from "vitest";
import { e2eEnv, envFile, localUrls, nextDevArgs, supabaseEnv } from "./local-env.mjs";

const status = JSON.stringify({
  API_URL: "http://127.0.0.1:54321",
  ANON_KEY: "eyJ.anon",
  PUBLISHABLE_KEY: "sb_publishable_x",
  STUDIO_URL: "http://127.0.0.1:54323",
  MAILPIT_URL: "http://127.0.0.1:54324",
  DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
});

describe("supabaseEnv", () => {
  it("prende indirizzo e publishable key", () => {
    expect(supabaseEnv(status)).toEqual({
      ok: true,
      value: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      },
    });
  });

  it("ripiega sulla anon key con le CLI più vecchie", () => {
    const old = JSON.stringify({ API_URL: "http://127.0.0.1:54321", ANON_KEY: "eyJ.anon" });
    expect(supabaseEnv(old)).toMatchObject({ ok: true, value: { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "eyJ.anon" } });
  });

  it("restituisce un errore se l'output non è utilizzabile", () => {
    expect(supabaseEnv("not json").ok).toBe(false);
    expect(supabaseEnv("{}").ok).toBe(false);
  });
});

describe("e2eEnv", () => {
  it("aggiunge la chiave di servizio e Mailpit", () => {
    const full = JSON.stringify({ ...JSON.parse(status), SERVICE_ROLE_KEY: "eyJ.service", SECRET_KEY: "sb_secret_x" });
    expect(e2eEnv(full)).toEqual({
      ok: true,
      value: {
        E2E_SUPABASE_URL: "http://127.0.0.1:54321",
        E2E_SUPABASE_KEY: "sb_publishable_x",
        E2E_SUPABASE_SECRET_KEY: "eyJ.service",
        E2E_MAILPIT_URL: "http://127.0.0.1:54324",
      },
    });
  });

  it("restituisce un errore senza chiave di servizio", () => {
    expect(e2eEnv(status).ok).toBe(false);
    expect(e2eEnv("not json").ok).toBe(false);
  });
});

describe("localUrls", () => {
  it("elenca solo i servizi presenti", () => {
    expect(localUrls(JSON.stringify({ STUDIO_URL: "s" })).map(([name]) => name)).toEqual(["App", "Studio"]);
    expect(localUrls(status)).toHaveLength(4);
  });
});

describe("envFile", () => {
  it("scrive le variabili e lascia vuota la chiave di Google", () => {
    const text = envFile({ NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k" });
    expect(text).toContain("NEXT_PUBLIC_SUPABASE_URL=u\n");
    expect(text).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=k\n");
    expect(text).toContain("GOOGLE_BOOKS_API_KEY=\n");
  });
});

describe("nextDevArgs", () => {
  it("usa 127.0.0.1 se non è indicato un host", () => {
    expect(nextDevArgs(["-p", "3001"])).toEqual(["dev", "--hostname", "127.0.0.1", "-p", "3001"]);
  });

  it("rispetta l'host scelto", () => {
    expect(nextDevArgs(["-H", "0.0.0.0"])).toEqual(["dev", "-H", "0.0.0.0"]);
    expect(nextDevArgs(["--hostname=0.0.0.0"])).toEqual(["dev", "--hostname=0.0.0.0"]);
  });
});
