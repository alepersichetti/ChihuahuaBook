import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

describe("header di sicurezza", () => {
  it("in produzione la CSP blocca frame, plugin ed eval", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co", development: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("in sviluppo permette eval e websocket per il ricaricamento", () => {
    const csp = contentSecurityPolicy({ development: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
  });

  it("include gli header di base", () => {
    const keys = securityHeaders({ development: false }).map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining(["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy"]),
    );
  });
});
