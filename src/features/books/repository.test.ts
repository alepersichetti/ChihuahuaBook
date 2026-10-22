import { describe, expect, it } from "vitest";
import { normalizeQuery } from "./repository";

describe("normalizeQuery", () => {
  it("toglie gli accenti come fa la colonna di ricerca", () => {
    expect(normalizeQuery("  Città perché ")).toBe("Citta perche");
  });
});
