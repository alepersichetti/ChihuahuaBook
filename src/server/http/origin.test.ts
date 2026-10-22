import { describe, expect, it } from "vitest";
import { appUrl, requestHost } from "./origin";

describe("origine della richiesta", () => {
  it("preferisce l'header Host a request.url", () => {
    const request = new Request("http://localhost:3100/auth/confirm", { headers: { host: "127.0.0.1:3100" } });
    expect(requestHost(request)).toBe("127.0.0.1:3100");
    expect(appUrl("/login?error=link", request).toString()).toBe("http://127.0.0.1:3100/login?error=link");
  });

  it("senza Host usa request.url", () => {
    const request = new Request("https://libri.example.com/x");
    expect(appUrl("/", request).toString()).toBe("https://libri.example.com/");
  });
});
