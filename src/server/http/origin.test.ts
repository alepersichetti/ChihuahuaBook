import { describe, expect, it } from "vitest";
import { requestOrigin } from "./origin";

const request = (headers: Record<string, string>) => new Request("http://localhost:3100/api/books", { headers });

describe("requestOrigin", () => {
  it("usa l'host chiesto dal browser, non quello di request.url", () => {
    expect(requestOrigin(request({ host: "127.0.0.1:3100" }))).toBe("http://127.0.0.1:3100");
  });

  it("dietro un proxy segue X-Forwarded-Host e X-Forwarded-Proto", () => {
    expect(
      requestOrigin(request({ host: "10.0.0.5:3000", "x-forwarded-host": "libri.example.com", "x-forwarded-proto": "https" })),
    ).toBe("https://libri.example.com");
  });

  it("senza header ripiega su request.url", () => {
    expect(requestOrigin(request({}))).toBe("http://localhost:3100");
  });
});
