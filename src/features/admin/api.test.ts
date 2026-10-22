import { afterEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "./api";

const respond = (status: number, body?: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })));

afterEach(() => vi.unstubAllGlobals());

describe("client admin", () => {
  it("restituisce i dati come Ok", async () => {
    respond(200, [{ email: "a@example.com" }]);
    expect((await adminApi.invitations())._unsafeUnwrap()).toEqual([{ email: "a@example.com" }]);
  });

  it("traduce gli stati HTTP in errori", async () => {
    respond(403, { error: "forbidden" });
    expect((await adminApi.members())._unsafeUnwrapErr()).toBe("forbidden");
    respond(409, { error: "conflict" });
    expect((await adminApi.updateMember("id", { role: "reader" }))._unsafeUnwrapErr()).toBe("lastAdmin");
  });

  it("una rete assente è un errore, non un'eccezione", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect((await adminApi.settings())._unsafeUnwrapErr()).toBe("network");
  });

  it("204 è un successo senza corpo", async () => {
    respond(204);
    expect((await adminApi.revoke("a@example.com")).isOk()).toBe(true);
  });
});
