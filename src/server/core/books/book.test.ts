import { describe, expect, it } from "vitest";
import { normalizeSearchText, withDerivedIsbn } from "./book";

describe("book", () => {
  it("toglie gli accenti come fa la colonna di ricerca", () => {
    expect(normalizeSearchText("  Città perché ")).toBe("Citta perche");
  });

  it("ricava l'ISBN mancante senza toccare l'originale", () => {
    const original = { isbn10: "8845292614" };
    expect(withDerivedIsbn(original)).toEqual({
      isbn10: "8845292614",
      isbn13: "9788845292613",
    });
    expect(original).toEqual({ isbn10: "8845292614" });
  });
});
