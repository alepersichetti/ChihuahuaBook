import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  connection: vi.fn(async () => {
    calls.push("connection");
  }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => {
    calls.push("cookies");
    return { getAll: () => [], set: () => undefined };
  }),
}));

const { createClient } = await import("./server");

describe("createClient (server)", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.unstubAllEnvs();
  });

  // supabase-js legge Date.now: senza connection() prima, Next lo segnala durante il prerender.
  it("passa da connection() prima di leggere i cookie", async () => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "chiave");
    const client = await createClient();
    expect(client.isOk()).toBe(true);
    expect(calls).toEqual(["connection", "cookies"]);
  });

  it("senza configurazione non tocca la richiesta", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const client = await createClient();
    expect(client.isErr()).toBe(true);
    expect(calls).toEqual([]);
  });
});
