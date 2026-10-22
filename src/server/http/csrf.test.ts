import { describe, expect, it } from "vitest";
import { isSameOriginRequest, sameOriginOnly } from "./csrf";

const request = (method: string, headers: Record<string, string>) =>
  new Request("https://libri.example.com/api/books", { method, headers });

const cookie = { cookie: "sb-access-token=x" };

describe("CSRF", () => {
  it("lascia passare le letture", () => {
    expect(isSameOriginRequest(request("GET", { ...cookie, origin: "https://evil.example" }))).toBe(true);
  });

  it("accetta le modifiche dalla stessa origine", () => {
    expect(isSameOriginRequest(request("POST", { ...cookie, origin: "https://libri.example.com" }))).toBe(true);
    expect(isSameOriginRequest(request("DELETE", { ...cookie, "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("confronta l'origine con l'host usato dal browser, anche quando request.url dice localhost", () => {
    const local = (origin: string) =>
      new Request("http://localhost:3100/api/books", { method: "POST", headers: { ...cookie, host: "127.0.0.1:3100", origin } });
    expect(isSameOriginRequest(local("http://127.0.0.1:3100"))).toBe(true);
    expect(isSameOriginRequest(local("http://evil.example"))).toBe(false);
    expect(isSameOriginRequest(local("null"))).toBe(false);
  });

  it("rifiuta le modifiche da un'altra origine o senza indicazioni", () => {
    expect(isSameOriginRequest(request("POST", { ...cookie, origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(request("PATCH", { ...cookie, "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(request("PUT", cookie))).toBe(false);
  });

  it("non riguarda i client con token Bearer o senza cookie", () => {
    expect(isSameOriginRequest(request("POST", { authorization: "Bearer t", origin: "https://app.other" }))).toBe(true);
    expect(isSameOriginRequest(request("POST", {}))).toBe(true);
  });

  it("risponde 403 senza chiamare l'handler", async () => {
    const handler = sameOriginOnly(async () => new Response("ok"));
    const response = await handler(request("POST", { ...cookie, origin: "https://evil.example" }));
    expect(response.status).toBe(403);
  });
});
