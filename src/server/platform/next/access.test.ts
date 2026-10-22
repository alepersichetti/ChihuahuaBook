import { describe, expect, it } from "vitest";
import { isPublicPath, loginUrl, safeNextPath } from "./access";

describe("accesso alle pagine", () => {
  it("login, callback di autenticazione e API sono pubblici", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/api/books")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
  });

  it("il catalogo e l'amministrazione richiedono la sessione", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/account/password")).toBe(false);
  });

  it("dopo il login torna solo a percorsi interni", () => {
    expect(safeNextPath("/admin?tab=1")).toBe("/admin?tab=1");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("il redirect al login ricorda la pagina richiesta", () => {
    expect(loginUrl("https://x.it/admin?a=1").toString()).toBe("https://x.it/login?next=%2Fadmin%3Fa%3D1");
    expect(loginUrl("https://x.it/").toString()).toBe("https://x.it/login");
  });
});
