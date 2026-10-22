import { describe, expect, it } from "vitest";
import { atLeast, authorize, can, isRole } from "./roles";

describe("ruoli", () => {
  it("ordina i ruoli dal lettore all'amministratore", () => {
    expect(atLeast("admin", "librarian")).toBe(true);
    expect(atLeast("librarian", "librarian")).toBe(true);
    expect(atLeast("reader", "librarian")).toBe(false);
  });

  it("il lettore legge soltanto", () => {
    expect(can("reader", "read")).toBe(true);
    expect(can("reader", "edit")).toBe(false);
    expect(can("reader", "administer")).toBe(false);
  });

  it("il bibliotecario modifica ma non amministra", () => {
    expect(can("librarian", "edit")).toBe(true);
    expect(can("librarian", "administer")).toBe(false);
  });

  it("l'amministratore può tutto", () => {
    expect(can("admin", "read") && can("admin", "edit") && can("admin", "administer")).toBe(true);
  });

  it("riconosce solo i ruoli noti", () => {
    expect(isRole("librarian")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it("authorize rifiuta con forbidden", async () => {
    const result = await authorize("edit")({ userId: "u", role: "reader" });
    expect(result._unsafeUnwrapErr()).toEqual({ kind: "forbidden" });
    const allowed = await authorize("edit")({ userId: "u", role: "admin" });
    expect(allowed.isOk()).toBe(true);
  });
});
